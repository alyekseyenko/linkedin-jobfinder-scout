// ============================================================
// 🤖 AUTONOMOUS LIVE AUTO-FILL SERVICE (HUMAN-IN-THE-LOOP)
// Playwright Automation for LinkedIn Easy Apply & External ATS Forms
// Contextualized with Candidate Profile & pgvector Semantic Memory
// ============================================================

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const vectorEngine = require('../vector_engine');

// In-memory registry of active autofill sessions
const activeSessions = new Map();

class AutofillService {
    constructor() {
        this.cvPath = path.join(__dirname, '..', 'user_cv.json');
        this.kbPath = path.join(__dirname, '..', 'knowledge_base.json');
    }

    /**
     * Retrieves the candidate's canonical information
     */
    getCandidateProfile() {
        let cvData = {};
        let kbData = {};
        try {
            if (fs.existsSync(this.cvPath)) {
                cvData = JSON.parse(fs.readFileSync(this.cvPath, 'utf8'));
            }
        } catch (e) {
            console.warn('[AUTOFILL] Error loading user_cv.json:', e.message);
        }

        try {
            if (fs.existsSync(this.kbPath)) {
                kbData = JSON.parse(fs.readFileSync(this.kbPath, 'utf8'));
            }
        } catch (e) {
            console.warn('[AUTOFILL] Error loading knowledge_base.json:', e.message);
        }

        const info = cvData.personal_info || {};
        const [firstName, ...lastNames] = (info.name || process.env.CANDIDATE_NAME || 'Your Full Name').split(' ');

        return {
            fullName: info.name || process.env.CANDIDATE_NAME || 'Your Full Name',
            firstName: firstName || 'Candidate',
            lastName: lastNames.join(' ') || 'User',
            email: info.email || process.env.CANDIDATE_EMAIL || 'your.email@example.com',
            phone: info.phone || process.env.CANDIDATE_PHONE || '+000 000 000 000',
            location: info.location || process.env.CANDIDATE_LOCATION || 'Your City, Country',
            country: process.env.CANDIDATE_COUNTRY || 'Portugal',
            city: process.env.CANDIDATE_CITY || 'Lisbon',
            postalCode: process.env.CANDIDATE_POSTAL_CODE || '1000-001',
            title: info.title || process.env.CANDIDATE_TITLE || 'AI Systems & Automation Engineer',
            linkedinUrl: process.env.CANDIDATE_LINKEDIN || 'https://www.linkedin.com/in/your-profile',
            githubUrl: process.env.CANDIDATE_GITHUB || 'https://github.com/your-username',
            website: process.env.CANDIDATE_WEBSITE || 'https://github.com/your-username',
            summary: cvData.summary || '',
            hardSkills: cvData.hard_skills || ['LangGraph', 'CrewAI', 'Python', 'FastAPI', 'Docker', 'PostgreSQL', 'Playwright'],
            workAuthorization: 'Yes',
            requireSponsorship: 'No',
            yearsExperience: '6'
        };
    }

    /**
     * Resolves an open-ended screening question using AI reasoning + pgvector semantic search
     */
    async answerScreeningQuestion(questionText, options = []) {
        if (!questionText || typeof questionText !== 'string') return 'Yes';
        const q = questionText.toLowerCase();

        // 1. Fast deterministic answers
        if (q.includes('work authorization') || q.includes('authorized to work') || q.includes('autorização de trabalho') || q.includes('direito a trabalhar') || q.includes('legally authorized')) {
            return options.find(o => o.toLowerCase().includes('yes') || o.toLowerCase().includes('sim')) || 'Yes';
        }
        if (q.includes('sponsorship') || q.includes('visa sponsorship') || q.includes('patrocínio de visto') || q.includes('require visa')) {
            return options.find(o => o.toLowerCase().includes('no') || o.toLowerCase().includes('não')) || 'No';
        }
        if (q.includes('notice period') || q.includes('aviso prévio') || q.includes('start date') || q.includes('disponibilidade')) {
            return 'Immediate / 2 weeks';
        }
        if (q.includes('driver') || q.includes('carta de condução') || q.includes('driving license')) {
            return options.find(o => o.toLowerCase().includes('yes') || o.toLowerCase().includes('sim')) || 'Yes';
        }
        if (q.includes('years of experience') || q.includes('anos de experiência') || q.includes('quantos anos')) {
            if (q.includes('ai') || q.includes('agent') || q.includes('python') || q.includes('automation') || q.includes('machine learning')) {
                return '4';
            }
            return '5';
        }

        // 2. Fetch context from pgvector Candidate Memory
        let contextKnowledge = '';
        try {
            const matches = await vectorEngine.searchCandidateMemory(questionText, 3);
            if (matches && matches.length > 0) {
                contextKnowledge = matches.map(m => m.text).join('\n---\n');
            }
        } catch (_) {}

        // 3. AI Agent Reasoning for Screening Question
        try {
            const aiService = require('./ai_service');
            const candidateInfo = this.getCandidateProfile();
            const prompt = `
You are the Autonomous Job Application Agent representing candidate ${candidateInfo.fullName} (${candidateInfo.title}).
Company screening question: "${questionText}"
${options.length > 0 ? `Available answer choices: [${options.join(', ')}]` : ''}

Candidate Real Context (from verified profile & semantic vault):
${contextKnowledge ? contextKnowledge.slice(0, 1000) : 'Senior AI Systems & Automation Engineer specializing in Python, LangGraph, FastAPI, Docker, Microservices, and Full-Stack Architecture.'}

Instructions:
- If multiple choice options are provided, select EXACTLY the option that best highlights the candidate's capabilities.
- If it is a numeric answer (e.g. years of experience), respond with ONLY the number (e.g. 5).
- If it is free text, respond directly, concisely, and professionally without clichés (maximum 2 sentences).
- Return ONLY the exact text of the answer with no greetings or quotes.
`;
            const aiAnswer = await aiService.getCombinedAICompletion(prompt, 'Respond strictly with the direct, concise answer.', false);
            if (aiAnswer && aiAnswer.trim().length > 0) {
                return aiAnswer.trim().replace(/^["']|["']$/g, '');
            }
        } catch (err) {
            console.warn('[AUTOFILL AGENT AI] Reasoning fallback:', err.message);
        }

        if (options.length > 0) return options[0];
        return 'Yes';
    }

    /**
     * Starts the live autofill session
     */
    async startAutofill({ jobId, jobUrl }) {
        if (!jobUrl && !jobId) {
            throw new Error('jobId or jobUrl is required');
        }

        const effectiveUrl = jobUrl || (jobId ? `https://www.linkedin.com/jobs/view/${jobId}` : '');
        console.log(`🤖 [AUTOFILL] Initializing Live Auto-Fill for Job: ${jobId} (${effectiveUrl})`);

        const session = {
            jobId: String(jobId),
            url: effectiveUrl,
            status: 'running',
            step: 'init',
            logs: [],
            screenshot: null,
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            readyForReview: false
        };

        const addLog = (msg) => {
            const timestamp = new Date().toLocaleTimeString();
            session.logs.push(`[${timestamp}] ${msg}`);
            session.updatedAt = new Date().toISOString();
            console.log(`[AUTOFILL ${jobId}] ${msg}`);
        };

        activeSessions.set(String(jobId), session);

        // Run automation in background so HTTP response returns immediately
        this._runPlaywrightAutofill(session, addLog).catch((err) => {
            console.error(`❌ [AUTOFILL] Error during execution:`, err);
            session.status = 'error';
            session.error = err.message;
            addLog(`❌ Erro: ${err.message}`);
        });

        return {
            success: true,
            jobId: session.jobId,
            message: 'Live Auto-Fill iniciado. Acompanha o progresso no painel.'
        };
    }

    /**
     * Internal Playwright automation routine with Human-In-The-Loop gate
     */
    async _runPlaywrightAutofill(session, addLog) {
        addLog('🌐 A iniciar motor Playwright com perfil do candidato...');
        session.step = 'launching_browser';

        const profile = this.getCandidateProfile();
        let browser = null;
        let context = null;
        let page = null;

        try {
            // Launch browser with stealth args
            const isHeadless = process.env.HEADLESS !== 'false';
            const launchOptions = {
                headless: isHeadless,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-blink-features=AutomationControlled'
                ]
            };

            // Obter token li_at do Vault, Ambiente ou cookies.json
            let cleanToken = null;
            try {
                const vaultService = require('./vault_service');
                vaultService.loadVault();
                cleanToken = vaultService.getSecret('li_at') || vaultService.getSecret('linkedin_cookie');
            } catch (_) {}

            if (!cleanToken) {
                const envVal = process.env.LI_AT || process.env.LINKEDIN_COOKIE || process.env.LINKEDIN_SESSION_COOKIE;
                if (envVal) cleanToken = envVal.replace(/^li_at=/, '').trim();
            }

            if (!cleanToken) {
                const cookiesPath = path.join(__dirname, '..', 'cookies.json');
                if (fs.existsSync(cookiesPath)) {
                    try {
                        const parsed = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
                        const c = parsed.find(x => x.name === 'li_at');
                        if (c) cleanToken = c.value;
                    } catch (_) {}
                }
            }

            if (cleanToken) {
                cleanToken = cleanToken.replace(/^li_at=/, '').trim();
            }

            // Iniciar browser isolado e de alta velocidade
            try {
                if (process.env.HEADLESS === 'false') {
                    browser = await chromium.launch({ ...launchOptions, channel: 'chrome' });
                } else {
                    browser = await chromium.launch(launchOptions);
                }
            } catch (e) {
                browser = await chromium.launch(launchOptions);
            }

            context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                viewport: { width: 1280, height: 800 },
                locale: 'pt-PT'
            });

            let injectedCookies = [];
            const cookiesPath = path.join(__dirname, '..', 'cookies.json');
            if (fs.existsSync(cookiesPath)) {
                try {
                    const parsed = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        injectedCookies = parsed.map(c => ({
                            name: c.name,
                            value: c.value,
                            domain: c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
                            path: c.path || '/',
                            httpOnly: c.httpOnly ?? true,
                            secure: c.secure ?? true,
                            sameSite: 'Lax'
                        }));
                    }
                } catch (_) {}
            }

            // Injetar o cookie de autenticação li_at
            if (cleanToken) {
                const tokenVal = cleanToken.replace(/^li_at=/, '').trim();
                
                injectedCookies = [
                    {
                        name: 'li_at',
                        value: tokenVal,
                        domain: '.linkedin.com',
                        path: '/',
                        httpOnly: true,
                        secure: true,
                        sameSite: 'None'
                    },
                    {
                        name: 'li_at',
                        value: tokenVal,
                        domain: 'www.linkedin.com',
                        path: '/',
                        httpOnly: true,
                        secure: true,
                        sameSite: 'None'
                    }
                ];
            }

            if (injectedCookies.length > 0) {
                addLog(`🔑 A injetar ${injectedCookies.length} cookies de sessão autenticada no Auto-Fill...`);
                await context.addCookies(injectedCookies);
                addLog('✅ Sessão LinkedIn do utilizador ligada com sucesso!');
            } else {
                addLog('⚠️ Nenhum cookie li_at detetado. O LinkedIn poderá solicitar autenticação.');
            }

            page = await context.newPage();
            session.pageRef = page;
            session.browserRef = browser;

            // Stealth: disguise navigator.webdriver & environment signatures (Anti-Bot Forensics)
            await page.addInitScript(() => {
                // 1. Wipe webdriver trace
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

                // 2. Mock plugins list
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [
                        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' },
                        { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer' }
                    ]
                });

                // 3. Mock languages & platform
                Object.defineProperty(navigator, 'languages', { get: () => ['pt-PT', 'pt', 'en-US', 'en'] });
                Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });

                // 4. Mock Hardware & RAM
                Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
                Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

                // 5. Mock WebGL context to pretend standard hardware GPU
                const getParameter = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
                        return 'Intel Inc.';
                    }
                    if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
                        return 'Intel(R) Iris(R) Xe Graphics';
                    }
                    return getParameter.apply(this, arguments);
                };
            });

            addLog(`🔗 A navegar para a vaga: ${session.url}`);
            session.step = 'navigating';
            try {
                await page.goto(session.url, { waitUntil: 'domcontentloaded', timeout: 35000 });
            } catch (navErr) {
                if (navErr.message.includes('ERR_TOO_MANY_REDIRECTS')) {
                    addLog('⚠️ Detetado redirecionamento excessivo no link da vaga. A carregar em modo direto...');
                    await page.close().catch(() => {});
                    await context.clearCookies().catch(() => {});
                    page = await context.newPage();
                    await page.addInitScript(() => {
                        Object.defineProperty(navigator, 'webdriver', {
                            get: () => undefined
                        });
                    });
                    await page.goto(session.url, { waitUntil: 'domcontentloaded', timeout: 35000 });
                } else {
                    throw navErr;
                }
            }
            await page.waitForTimeout(2000);

            // Take initial screenshot
            session.screenshot = (await page.screenshot()).toString('base64');

            // Detect whether this is LinkedIn Easy Apply or an External ATS Link
            addLog('🔍 A analisar o tipo de candidatura (Candidatura Simplificada vs. Link Externo)...');
            session.step = 'detecting_apply_type';

            // Check for Easy Apply button
            const easyApplySelector = [
                'button.jobs-apply-button',
                'button:has-text("Candidatura simplificada")',
                'button:has-text("Easy Apply")',
                'button:has-text("Candidatar-se simplificadamente")',
                '.jobs-apply-button--top-card'
            ].join(', ');

            const easyApplyBtn = await page.$(easyApplySelector);

            if (easyApplyBtn) {
                addLog('⚡ Vaga detetada como [Candidatura Simplificada] no LinkedIn!');
                await this._handleLinkedInEasyApply(page, profile, session, addLog, browser);
            } else {
                addLog('🌐 Vaga direciona para Link Externo (ATS da empresa)...');
                await this._handleExternalATS(page, profile, session, addLog, browser);
            }

        } catch (error) {
            session.status = 'error';
            session.error = error.message;
            addLog(`⚠️ Falha na execução: ${error.message}`);
            if (page) {
                try {
                    session.screenshot = (await page.screenshot()).toString('base64');
                } catch (_) {}
            }
        }
    }

    /**
     * Handles LinkedIn Easy Apply multi-step modal
     */
    async _handleLinkedInEasyApply(page, profile, session, addLog, browser = null) {
        session.step = 'easy_apply_active';
        addLog('🖱️ A clicar em "Candidatura Simplificada"...');

        try {
            await page.click('button.jobs-apply-button, button:has-text("Candidatura simplificada"), button:has-text("Easy Apply")');
            await page.waitForTimeout(2500);
        } catch (e) {
            addLog('⚠️ Botão de candidatura já pressionado ou modal aberto.');
        }

        let maxSteps = 10;
        let currentStepNum = 1;

        while (maxSteps > 0) {
            maxSteps--;
            addLog(`📝 Passo ${currentStepNum}: A preencher dados do formulário...`);
            session.screenshot = (await page.screenshot()).toString('base64');

            // 1. Fill phone number if empty
            await page.evaluate((prof) => {
                const phoneInput = document.querySelector('input[id*="phoneNumber"], input[name*="phoneNumber"], input[type="tel"]');
                if (phoneInput && (!phoneInput.value || phoneInput.value.trim() === '')) {
                    phoneInput.value = prof.phone;
                    phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
                    phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Email
                const emailInput = document.querySelector('input[id*="email"], input[name*="email"]');
                if (emailInput && (!emailInput.value || emailInput.value.trim() === '')) {
                    emailInput.value = prof.email;
                    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, profile);

            // 2. Autonomous Form Perception & AI Resolution (Inputs, Selects, Radio Buttons)
            const formElements = await page.evaluate(() => {
                const items = [];
                // Find all form field groupings
                const groups = document.querySelectorAll('.jobs-easy-apply-form-section__grouping, .fb-dash-form-element, .jobs-document-upload');
                
                groups.forEach((group, idx) => {
                    const labelEl = group.querySelector('label, legend, .fb-dash-form-element__label');
                    const label = labelEl ? labelEl.innerText.trim() : '';

                    // Check for text/number/tel input
                    const input = group.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="file"])');
                    if (input && (!input.value || input.value.trim() === '')) {
                        items.push({
                            id: idx,
                            type: input.type || 'text',
                            label: label || input.placeholder || 'Campo de texto',
                            selector: `input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="file"])`,
                            groupIndex: idx
                        });
                        return;
                    }

                    // Check for dropdown select
                    const select = group.querySelector('select');
                    if (select && (!select.value || select.value === 'Select an option' || select.value === '')) {
                        const options = Array.from(select.options).map(o => o.text.trim()).filter(t => t && !t.includes('Select an option'));
                        items.push({
                            id: idx,
                            type: 'select',
                            label: label || 'Seleção',
                            options,
                            groupIndex: idx
                        });
                        return;
                    }

                    // Check for radio buttons
                    const radios = group.querySelectorAll('input[type="radio"]');
                    if (radios.length > 0) {
                        const isChecked = Array.from(radios).some(r => r.checked);
                        if (!isChecked) {
                            const radioLabels = Array.from(group.querySelectorAll('label')).map(l => l.innerText.trim());
                            items.push({
                                id: idx,
                                type: 'radio',
                                label: label || 'Opção de rádio',
                                options: radioLabels,
                                groupIndex: idx
                            });
                        }
                    }
                });

                return items;
            });

            if (formElements.length > 0) {
                addLog(`🤖 Agente de Raciocínio: A resolver ${formElements.length} campos detectados no ecrã...`);
                for (const item of formElements) {
                    const resolvedAnswer = await this.answerScreeningQuestion(item.label, item.options || []);
                    addLog(`⚡ "${item.label.slice(0, 40)}..." ➔ IA: "${resolvedAnswer}"`);

                    // Apply answer to page
                    await page.evaluate(({ item, resolvedAnswer }) => {
                        const groups = document.querySelectorAll('.jobs-easy-apply-form-section__grouping, .fb-dash-form-element');
                        const group = groups[item.groupIndex];
                        if (!group) return;

                        if (item.type === 'select') {
                            const select = group.querySelector('select');
                            if (select) {
                                const opt = Array.from(select.options).find(o => 
                                    o.text.toLowerCase().includes(resolvedAnswer.toLowerCase()) || 
                                    resolvedAnswer.toLowerCase().includes(o.text.toLowerCase())
                                );
                                if (opt) {
                                    select.value = opt.value;
                                    select.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }
                        } else if (item.type === 'radio') {
                            const labels = Array.from(group.querySelectorAll('label'));
                            const targetLabel = labels.find(l => 
                                l.innerText.toLowerCase().includes(resolvedAnswer.toLowerCase()) || 
                                resolvedAnswer.toLowerCase().includes(l.innerText.toLowerCase())
                            );
                            if (targetLabel) {
                                targetLabel.click();
                            } else if (labels.length > 0) {
                                labels[0].click();
                            }
                        } else {
                            const input = group.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])');
                            if (input) {
                                input.value = resolvedAnswer;
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }
                    }, { item, resolvedAnswer });
                    
                    await page.waitForTimeout(300);
                }
            }

            // 3. Check for Next / Review / Submit buttons using standard DOM traversal in page.evaluate
            const isReviewStep = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const submitBtn = buttons.find(b => {
                    const txt = (b.innerText || '').toLowerCase();
                    const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                    return txt.includes('enviar candidatura') || 
                           txt.includes('submit application') || 
                           txt.includes('submit') || 
                           aria.includes('submit application') || 
                           aria.includes('enviar candidatura');
                });
                const headings = Array.from(document.querySelectorAll('h3, h4, .jobs-easy-apply-modal__review-title'));
                const reviewTitle = headings.find(h => {
                    const txt = (h.innerText || '').toLowerCase();
                    return txt.includes('review') || txt.includes('rever') || txt.includes('revisão');
                });
                return !!(submitBtn || reviewTitle);
            });

            // 🛑 HUMAN-IN-THE-LOOP CHECK:
            if (isReviewStep) {
                addLog('🛑 PARAGEM HUMAN-IN-THE-LOOP ATIVADA!');
                addLog('🟢 A candidatura está completamente preenchida e chegou ao ecrã de revisão final.');
                addLog('👉 Por favor revê as informações no ecrã e clica em "Enviar Candidatura" quando aprovares.');
                session.status = 'ready_for_review';
                session.readyForReview = true;
                session.step = 'human_review_required';
                session.screenshot = (await page.screenshot()).toString('base64');
                return;
            }

            // Otherwise, attempt to click Next / Avançar
            const nextClicked = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const nextBtn = buttons.find(b => {
                    const txt = (b.innerText || '').toLowerCase();
                    const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                    const isNext = txt.includes('seguinte') || 
                                   txt.includes('avançar') || 
                                   txt.includes('next') || 
                                   aria.includes('continue to next step');
                    const isSubmit = txt.includes('enviar') || txt.includes('submit');
                    return isNext && !isSubmit;
                }) || document.querySelector('button.artdeco-button--primary:not([disabled])');

                if (nextBtn && !nextBtn.innerText.toLowerCase().includes('enviar') && !nextBtn.innerText.toLowerCase().includes('submit')) {
                    nextBtn.click();
                    return true;
                }
                return false;
            });

            if (nextClicked) {
                currentStepNum++;
                await page.waitForTimeout(2000);
            } else {
                // If no next button found, we might already be on the final screen
                addLog('🏁 Fim dos passos automáticos. Ecrã pronto para revisão final.');
                session.status = 'ready_for_review';
                session.readyForReview = true;
                session.step = 'human_review_required';
                session.screenshot = (await page.screenshot()).toString('base64');
                break;
            }
        }
    }

    /**
     * Handles External ATS application page (Greenhouse, Lever, Ashby, Workday, etc.)
     */
    async _handleExternalATS(page, profile, session, addLog, browser = null) {
        session.step = 'external_ats_active';
        addLog('🖱️ A localizar e acionar botão de candidatura externa ("Candidatar-se / Apply")...');

        let activePage = page;

        // 1. Click external apply button and handle possible new tab/popup
        try {
            // Extrair o URL de destino direto do botão de candidatura externa para evitar modal de registo do LinkedIn
            const directTargetUrl = await page.evaluate(() => {
                const selectors = [
                    'a.jobs-apply-button',
                    'a[href*="apply"]',
                    'a[data-tracking-control-name*="apply"]',
                    'a[data-control-name*="apply"]',
                    'a[data-job-id]'
                ];
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el && el.href) return el.href;
                }
                const links = Array.from(document.querySelectorAll('a'));
                const applyLink = links.find(a => {
                    const txt = (a.innerText || '').toLowerCase();
                    return (txt.includes('candidatar-se') || txt.includes('apply')) && a.href;
                });
                return applyLink ? applyLink.href : null;
            });

            if (directTargetUrl && !directTargetUrl.includes('cold-join') && !directTargetUrl.includes('signup')) {
                // Verificar se o URL contém um link codificado de redirecionamento (ex: url=http...)
                let finalUrl = directTargetUrl;
                try {
                    const urlObj = new URL(directTargetUrl);
                    const redirectParam = urlObj.searchParams.get('url') || urlObj.searchParams.get('session_redirect');
                    if (redirectParam && redirectParam.startsWith('http')) {
                        finalUrl = decodeURIComponent(redirectParam);
                    }
                } catch (_) {}

                addLog(`🌐 A navegar diretamente para o link de candidatura externa: ${finalUrl.slice(0, 70)}...`);
                await activePage.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
                await activePage.waitForTimeout(3000);
            } else {
                const [newPage] = await Promise.all([
                    page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null),
                    page.evaluate(() => {
                        const selectors = [
                            'a.jobs-apply-button',
                            'button.jobs-apply-button',
                            'a[href*="apply"]',
                            'button[aria-label*="Apply"]',
                            'button[aria-label*="Candidatar"]'
                        ];
                        for (const sel of selectors) {
                            const el = document.querySelector(sel);
                            if (el) {
                                el.click();
                                return true;
                            }
                        }
                        const allLinks = Array.from(document.querySelectorAll('a, button'));
                        const applyBtn = allLinks.find(el => {
                            const txt = (el.innerText || '').toLowerCase();
                            return txt.includes('candidatar-se') || 
                                   txt.includes('apply on company website') || 
                                   txt.includes('candidatar-se no site da empresa') || 
                                   txt === 'apply' || txt === 'candidatar-se';
                        });
                        if (applyBtn) {
                            applyBtn.click();
                            return true;
                        }
                        return false;
                    })
                ]);

                if (newPage) {
                    addLog('🌐 Aberta nova aba com o formulário de candidatura da empresa!');
                    activePage = newPage;
                    await activePage.waitForLoadState('domcontentloaded');
                    await activePage.waitForTimeout(3000);
                } else {
                    await activePage.waitForTimeout(3000);
                }
            }
        } catch (e) {
            addLog(`⚠️ Aviso na navegação externa: ${e.message}`);
        }

        addLog(`🌐 A inspecionar portal de candidatura: ${activePage.url().slice(0, 60)}...`);
        session.screenshot = (await activePage.screenshot()).toString('base64');

        // 2. Loop step-by-step through external ATS forms
        let externalSteps = 5;
        let stepCount = 1;

        while (externalSteps > 0) {
            externalSteps--;
            addLog(`📝 Passo ATS ${stepCount}: A preencher campos universais e específicos...`);

            // Universal ATS Input Autofill
            await activePage.evaluate((prof) => {
                const fillIfFound = (selectors, value) => {
                    if (!value) return;
                    for (const sel of selectors) {
                        const elements = document.querySelectorAll(sel);
                        elements.forEach(el => {
                            if (el && (!el.value || el.value.trim() === '')) {
                                el.value = value;
                                el.dispatchEvent(new Event('input', { bubbles: true }));
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        });
                    }
                };

                // Personal info
                fillIfFound(['input[name*="first_name" i]', 'input[id*="first_name" i]', 'input[name*="firstName" i]', 'input[autocomplete="given-name"]'], prof.firstName);
                fillIfFound(['input[name*="last_name" i]', 'input[id*="last_name" i]', 'input[name*="lastName" i]', 'input[autocomplete="family-name"]'], prof.lastName);
                fillIfFound(['input[name*="name" i]:not([name*="first"]):not([name*="last"])', 'input[id*="name" i]:not([id*="first"]):not([id*="last"])', 'input[autocomplete="name"]'], prof.fullName);
                fillIfFound(['input[type="email"]', 'input[name*="email" i]', 'input[id*="email" i]'], prof.email);
                fillIfFound(['input[type="tel"]', 'input[name*="phone" i]', 'input[id*="phone" i]'], prof.phone);
                
                // Professional Links
                fillIfFound(['input[name*="linkedin" i]', 'input[id*="linkedin" i]', 'input[placeholder*="linkedin" i]'], prof.linkedinUrl);
                fillIfFound(['input[name*="github" i]', 'input[id*="github" i]', 'input[name*="portfolio" i]', 'input[name*="website" i]', 'input[placeholder*="github" i]'], prof.githubUrl);
                
                // Location / City
                fillIfFound(['input[name*="city" i]', 'input[name*="location" i]', 'input[id*="location" i]', 'input[id*="city" i]'], prof.location);
            }, profile);

            // 3. Autonomous AI Question & Element Filling on External Forms
            const dynamicFields = await activePage.evaluate(() => {
                const fields = [];
                const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]), textarea, select'));
                
                inputs.forEach((el, index) => {
                    if (el.value && el.value.trim() !== '' && el.value !== 'Select an option') return;
                    
                    // Find associated label or placeholder
                    let labelText = '';
                    if (el.id) {
                        const lbl = document.querySelector(`label[for="${el.id}"]`);
                        if (lbl) labelText = lbl.innerText.trim();
                    }
                    if (!labelText) {
                        const parentLabel = el.closest('label');
                        if (parentLabel) labelText = parentLabel.innerText.trim();
                    }
                    if (!labelText) {
                        labelText = el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('aria-label') || '';
                    }

                    if (labelText && labelText.length > 2) {
                        let options = [];
                        if (el.tagName.toLowerCase() === 'select') {
                            options = Array.from(el.options).map(o => o.text.trim()).filter(t => t && !t.includes('Select'));
                        }
                        fields.push({
                            index,
                            tagName: el.tagName.toLowerCase(),
                            type: el.type || 'text',
                            label: labelText,
                            options
                        });
                    }
                });
                return fields.slice(0, 10);
            });

            if (dynamicFields.length > 0) {
                addLog(`🤖 Agente de Raciocínio ATS: A resolver ${dynamicFields.length} campos específicos...`);
                for (const field of dynamicFields) {
                    const resolvedAnswer = await this.answerScreeningQuestion(field.label, field.options || []);
                    addLog(`⚡ "${field.label.slice(0, 35)}..." ➔ IA: "${resolvedAnswer}"`);

                    await activePage.evaluate(({ field, resolvedAnswer }) => {
                        const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]), textarea, select'));
                        const el = inputs[field.index];
                        if (!el) return;

                        if (field.tagName === 'select') {
                            const opt = Array.from(el.options).find(o => 
                                o.text.toLowerCase().includes(resolvedAnswer.toLowerCase()) || 
                                resolvedAnswer.toLowerCase().includes(o.text.toLowerCase())
                            );
                            if (opt) {
                                el.value = opt.value;
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        } else {
                            el.value = resolvedAnswer;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }, { field, resolvedAnswer });
                    
                    await activePage.waitForTimeout(200);
                }
            }

            session.screenshot = (await activePage.screenshot()).toString('base64');

            // 4. Check if we reached final submission button
            const hasSubmit = await activePage.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
                return buttons.some(b => {
                    const txt = (b.innerText || b.value || b.getAttribute('aria-label') || '').toLowerCase();
                    return txt.includes('submit application') || 
                           txt.includes('enviar candidatura') || 
                           txt.includes('submit application') || 
                           txt === 'submit';
                });
            });

            if (hasSubmit) {
                addLog('🛑 PARAGEM HUMAN-IN-THE-LOOP ATIVADA!');
                addLog('🟢 Todos os campos do portal externo foram preenchidos com inteligência.');
                addLog('👉 Por favor revê as informações no ecrã e clica em "Submeter Candidatura" quando aprovares.');
                session.status = 'ready_for_review';
                session.readyForReview = true;
                session.step = 'human_review_required';
                session.screenshot = (await activePage.screenshot()).toString('base64');
                return;
            }

            // Otherwise, attempt to click Next / Continue
            const nextClicked = await activePage.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, a'));
                const nextBtn = buttons.find(b => {
                    const txt = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase();
                    return txt.includes('next') || txt.includes('continue') || txt.includes('avançar') || txt.includes('seguinte');
                });
                if (nextBtn) {
                    nextBtn.click();
                    return true;
                }
                return false;
            });

            if (nextClicked) {
                stepCount++;
                await activePage.waitForTimeout(3000);
            } else {
                break;
            }
        }

        session.screenshot = (await activePage.screenshot()).toString('base64');
        session.lastUserInteraction = Date.now();
        session.pageRef = activePage;
        session.browserRef = browser;

        addLog('🛑 PARAGEM HUMAN-IN-THE-LOOP ATIVADA!');
        addLog('🟢 Formulário externo analisado e preenchido na totalidade.');
        addLog('👉 Por favor verifica o formulário no ecrã e clica em submeter.');

        session.status = 'ready_for_review';
        session.readyForReview = true;
        session.step = 'human_review_required';
    }

    /**
     * Dispatches a remote click coordinate from user preview image into the live browser session
     */
    async sendUserClick(jobId, { xPercent, yPercent }) {
        const session = activeSessions.get(String(jobId));
        if (!session || !session.pageRef) {
            throw new Error('Sessão ativa de navegador não encontrada.');
        }

        session.lastUserInteraction = Date.now();
        const page = session.pageRef;

        // Calculate actual viewport coordinates based on current window dimensions
        const viewport = page.viewportSize() || { width: 1280, height: 800 };
        const x = Math.round((xPercent / 100) * viewport.width);
        const y = Math.round((yPercent / 100) * viewport.height);

        console.log(`[HITL INTERACTION] User clicked on preview at (${xPercent}%, ${yPercent}%) ➔ Viewport (${x}px, ${y}px)`);

        // Perform real mouse move and click
        await page.mouse.move(x, y, { steps: 5 });
        await page.mouse.click(x, y);
        await page.waitForTimeout(600);

        // Update screenshot after click
        session.screenshot = (await page.screenshot()).toString('base64');

        return {
            success: true,
            message: `Clique executado em (${x}px, ${y}px)`,
            screenshot: session.screenshot
        };
    }

    /**
     * Types text directly into the focused element after a user click
     */
    async sendUserType(jobId, { text }) {
        const session = activeSessions.get(String(jobId));
        if (!session || !session.pageRef) {
            throw new Error('Sessão ativa de navegador não encontrada.');
        }

        session.lastUserInteraction = Date.now();
        const page = session.pageRef;

        console.log(`[HITL INTERACTION] User typed into preview: "${text}"`);
        await page.keyboard.type(text, { delay: 50 });
        await page.waitForTimeout(400);

        session.screenshot = (await page.screenshot()).toString('base64');

        return {
            success: true,
            message: `Texto introduzido no campo ativo`,
            screenshot: session.screenshot
        };
    }

    /**
     * Gets status of an active or recent autofill session
     */
    getSessionStatus(jobId) {
        const session = activeSessions.get(String(jobId));
        if (!session) {
            return { found: false, status: 'idle' };
        }
        return {
            found: true,
            ...session
        };
    }
}

module.exports = new AutofillService();
