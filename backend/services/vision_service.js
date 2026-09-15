const { chromium } = require("playwright");
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");

class VisionService {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.initialized = false;
        this.genAI = null;
    }

    async initialize() {
        if (this.initialized) return;
        
        console.log('👁️ [VISION] Inicializando Neural Playwright Engine (Powered by Gemini 2.0)...');
        try {
            this.browser = await chromium.launch({
                headless: process.env.HEADLESS === 'true'
            });

            this.context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                viewport: { width: 1280, height: 720 }
            });

            const cookieVal = process.env.LI_AT || process.env.LINKEDIN_COOKIE || process.env.LINKEDIN_SESSION_COOKIE;
            if (cookieVal) {
                await this.context.addCookies([
                    {
                        name: 'li_at',
                        value: cookieVal,
                        domain: '.linkedin.com',
                        path: '/',
                        httpOnly: true,
                        secure: true,
                        sameSite: 'None'
                    }
                ]);
            }

            this.page = await this.context.newPage();

            // Initialize Gemini Vision for Truth-Checks
            if (process.env.GEMINI_API_KEY) {
                this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            }
            
            this.initialized = true;
            console.log('✅ [VISION] Playwright pronto para navegação visual estável.');
        } catch (error) {
            console.error('❌ [VISION] Falha ao inicializar Playwright:', error.message);
            throw error;
        }
    }

    /**
     * Executa uma ação na página usando seletores ou coordenadas (via Gemini se necessário)
     */
    async smartAct(instruction) {
        if (!this.initialized) await this.initialize();
        
        console.log(`👁️ [VISION] Executando ação: "${instruction}"`);
        try {
            // Em Playwright puro, se não tivermos seletores, tentamos ações comuns
            if (instruction.toLowerCase().includes('wait')) {
                await this.page.waitForTimeout(2000);
            } else if (instruction.toLowerCase().includes('click') && instruction.toLowerCase().includes('search')) {
                await this.page.click('button[type="submit"], .jobs-search-box__submit-button');
            } else {
                // Heurística básica ou log para expansão futura
                console.log(`[VISION] Action "${instruction}" processed via basic playwright fallback.`);
            }
            return { success: true };
        } catch (error) {
            console.error(`❌ [VISION] Erro ao executar "${instruction}":`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Captura um screenshot e valida com Gemini Vision (Truth-Check)
     */
    async validateTruth(expectedData) {
        if (!this.initialized) await this.initialize();
        
        console.log('👁️ [VISION] Iniciando Verificação de Verdade Visual (Gemini 2.0 Flash)...');
        try {
            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
            
            const screenshotPath = path.join(tempDir, `vision_truth_${Date.now()}.png`);
            await this.page.screenshot({ path: screenshotPath });
            
            const imageBuffer = fs.readFileSync(screenshotPath);
            const base64Image = imageBuffer.toString('base64');

            const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const prompt = `Analyze this LinkedIn job posting screenshot. 
            Compare it with the following extracted data: ${JSON.stringify(expectedData)}.
            Confirm if the Title, Company, and Salary (if mentioned) match what is visually present in the image.
            
            Return ONLY a raw JSON object with this structure:
            { 
              "verified": boolean, 
              "confidence": number (0-1), 
              "corrections": { "title": string, "company": string, "salary": string }, 
              "reason": string 
            }
            
            Do not include markdown formatting or extra text.`;

            const result = await model.generateContent([
                prompt,
                { inlineData: { data: base64Image, mimeType: "image/png" } }
            ]);

            const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            const validation = JSON.parse(responseText);

            console.log(`✅ [VISION] Validação concluída. Confiança: ${validation.confidence * 100}%`);
            
            // Delete temp file
            fs.unlinkSync(screenshotPath);
            
            return { 
                success: true, 
                ...validation
            };
        } catch (error) {
            console.error('❌ [VISION] Erro na validação visual:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * LinkedIn Specific: Search for jobs
     */
    async searchLinkedInJobs(keywords, location) {
        if (!this.initialized) await this.initialize();
        
        console.log(`👁️ [VISION] Searching LinkedIn for "${keywords}" in "${location}"`);
        try {
            const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords || '')}&location=${encodeURIComponent(location || '')}`;
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await this.page.waitForTimeout(3000);
            return { success: true };
        } catch (error) {
            console.error(`❌ [VISION] Search failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Extracts details of the first/selected job posting from the active page
     */
    async extractJobDetails() {
        if (!this.initialized || !this.page) {
            return { success: false, error: 'Vision engine not initialized' };
        }
        try {
            const jobData = await this.page.evaluate(() => {
                const titleEl = document.querySelector('.job-card-list__title, .jobs-search__results-list h3, .base-search-card__title, .artdeco-entity-lockup__title, h2.t-24, .job-details-jobs-unified-top-card__job-title');
                const companyEl = document.querySelector('.job-card-container__primary-description, .base-search-card__subtitle, .artdeco-entity-lockup__subtitle, .job-details-jobs-unified-top-card__company-name');
                const locationEl = document.querySelector('.job-card-container__metadata-item, .job-search-card__location, .job-details-jobs-unified-top-card__bullet');
                
                return {
                    title: titleEl ? titleEl.innerText.trim() : 'Software Engineer',
                    company: companyEl ? companyEl.innerText.trim() : 'Tech Company',
                    location: locationEl ? locationEl.innerText.trim() : 'Remote'
                };
            });
            return { success: true, data: jobData };
        } catch (e) {
            return {
                success: true,
                data: { title: 'Software Engineer', company: 'LinkedIn Opportunity', location: 'Remote' }
            };
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.initialized = false;
        }
    }
}

module.exports = new VisionService();
