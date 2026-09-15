// ============================================================
// 💼 JOB ANALYSIS & MATCHING DOMAIN SERVICE
// Forensic DNA Matching, Metadata Extraction & Deep RAG Analysis
// ============================================================

const cheerio = require('cheerio');
const knowledgeService = require('./knowledge_service');
const aiService = require('./ai_service');
const vectorEngine = require('../vector_engine');

/**
 * Calculates a realistic, multi-factor match score (0-100%) between a candidate and a job.
 * Factor 1: Title & Seniority Alignment (0-35 points)
 * Factor 2: Technical Skills Overlap (0-45 points)
 * Factor 3: Domain & Experience Context (0-20 points)
 */
function calculateMatchAnalysis(description = '', jobTitle = '', candidateProfile = null) {
    if (!description && !jobTitle) return { score: 45, matched: [], missing: [], workArea: 'Technology' };

    // 1. Resolve candidate requirements
    const candidate = candidateProfile || knowledgeService.getUserTargetRequirements();
    const candTitle = candidate?.title || 'AI Systems & Automation Engineer';
    const candSkills = (candidate?.skills || []).map(s => s.toLowerCase().trim());
    const aggregatedSkills = knowledgeService.getAggregateUserSkills();
    const combinedUserSkills = Array.from(new Set([...candSkills, ...aggregatedSkills]));

    const textToAnalyze = `${jobTitle} ${description}`.toLowerCase();

    // 2. Title & Seniority Alignment (0-35 points)
    const candTitleTokens = candTitle.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2 && !['and', 'the', 'for', 'with'].includes(t));
    
    const jobTitleTokens = (jobTitle || '').toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2 && !['and', 'the', 'for', 'with'].includes(t));

    let titleMatches = 0;
    candTitleTokens.forEach(token => {
        if (jobTitleTokens.some(jt => jt.includes(token) || token.includes(jt))) {
            titleMatches++;
        }
    });

    const titleRatio = candTitleTokens.length > 0 ? (titleMatches / candTitleTokens.length) : 0.4;
    let titleScore = Math.min(35, Math.round(titleRatio * 35));

    // Seniority bonuses / penalties
    const isSeniorJob = textToAnalyze.includes('senior') || textToAnalyze.includes('lead') || textToAnalyze.includes('principal') || textToAnalyze.includes('architect') || textToAnalyze.includes('head');
    const isJuniorJob = textToAnalyze.includes('junior') || textToAnalyze.includes('intern') || textToAnalyze.includes('trainee') || textToAnalyze.includes('estágio') || textToAnalyze.includes('estagiário');

    if (isSeniorJob && !isJuniorJob) {
        titleScore = Math.min(35, titleScore + 5);
    }
    if (isJuniorJob) {
        titleScore = Math.max(5, titleScore - 15);
    }

    // 3. Technical Skills Overlap (0-45 points)
    const requiredInJob = knowledgeService.extractSkills(description, knowledgeService.MASTER_DICTIONARY);
    const matched = [];
    const missing = [];

    requiredInJob.forEach(skill => {
        const lower = skill.toLowerCase().trim();
        const hasSkill = combinedUserSkills.some(cs => cs === lower || cs.includes(lower) || lower.includes(cs));
        if (hasSkill) {
            matched.push(skill);
        } else {
            missing.push(skill);
        }
    });

    let skillsScore = 15;
    if (requiredInJob.length > 0) {
        skillsScore = Math.round((matched.length / requiredInJob.length) * 45);
    } else {
        // If the posting doesn't list tech keywords explicitly, base modestly on title score
        skillsScore = titleScore >= 20 ? 25 : 15;
    }

    // 4. Domain & Experience Context (0-20 points)
    const domainKeywords = [
        'agentic', 'agent', 'automation', 'workflow', 'microservices', 'cloud', 
        'enterprise', 'production', 'llm', 'machine learning', 'artificial intelligence',
        'rag', 'vector', 'pipeline', 'distributed', 'event-driven', 'scalable'
    ];
    let domainHits = 0;
    domainKeywords.forEach(dk => {
        if (textToAnalyze.includes(dk)) domainHits++;
    });
    const domainScore = Math.min(20, Math.round((domainHits / 4) * 20));

    // Total realistic score between 15% and 98%
    const totalScore = Math.min(98, Math.max(15, titleScore + skillsScore + domainScore));

    const workAreaMatch = description.match(/(Software Engineering|Data Science|DevOps|Cloud Architecture|Full-Stack|AI Systems|AI Automation|Machine Learning|Product Management)/i);
    const workArea = workAreaMatch ? workAreaMatch[0] : (requiredInJob[0] || 'AI & Software Systems');

    return {
        score: totalScore,
        matched,
        missing: missing.slice(0, 6),
        workArea,
        breakdown: { titleScore, skillsScore, domainScore }
    };
}

function extractSalaryFromText(text) {
    if (!text) return '';

    const salaryPatterns = [
        /(?:€|\$|£)\s?(\d{2,3}(?:[.,]\d{3})*(?:\s?[kK])?)\s?(?:-|a|to)\s?(?:€|\$|£)\s?(\d{2,3}(?:[.,]\d{3})*(?:\s?[kK])?)/i,
        /(?:salário|remuneração|salary|budget|vencimento|base)\s?(?:de|is|:)?\s?(?:€|\$|£)\s?(\d{2,3}(?:[.,]\d{3})*(?:\s?[kK])?)/i,
        /(\d{2,3}(?:[.,]\d{3})*(?:\s?[kK])?)\s?(?:€|\$|£)\s?(?:-|a|to)\s?(\d{2,3}(?:[.,]\d{3})*(?:\s?[kK])?)\s?(?:€|\$|£)/i,
        /(?:€|\$|£)\s?(\d{2,3}(?:[.,]\d{3})*(?:\s?[kK])?)/i
    ];

    for (const pattern of salaryPatterns) {
        const match = text.match(pattern);
        if (match) {
            if (match[2]) return `${match[1]} - ${match[2]}`.replace(/k/gi, '.000');
            return match[1].replace(/k/gi, '.000');
        }
    }

    return '';
}

function extractJobMetadata(detailData, job, description) {
    let title = job?.title || detailData?.title || '';
    let company = job?.company || detailData?.company || '';

    const genericTitles = ['Specialized Role', 'LinkedIn Job', 'Job', 'Opportunity', 'LinkedIn Opportunity', ''];
    const genericCompanies = ['LinkedIn Partner', 'LinkedIn Opportunity', 'Company', 'Unknown', ''];

    const hasValidTitle = title && !genericTitles.includes(title.trim()) && title.length < 100;
    const hasValidCompany = company && !genericCompanies.includes(company.trim()) && company.length < 60;

    if (hasValidTitle && hasValidCompany) {
        return { title: title.trim(), company: company.trim() };
    }

    if (description) {
        const lines = description.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 2 && !l.includes('Skip to main') && !l.includes('Log In'));

        let realLines = lines.filter(l =>
            !l.match(/há \d+ (dia|hora|minuto|mês|ano)/i) &&
            !l.match(/\d+ (day|hour|minute|month|year)s? ago/i) &&
            !l.match(/\d+ (pessoas|applicants)/) &&
            !l.match(/Reponsas gerenciadas|Respostas gerenciadas/i) &&
            !l.match(/fora do LinkedIn/i) &&
            !l.match(/Visualizar/i) &&
            !l.match(/Candidatar-se|Candidate-se|Apply|Salvar|Save|Veja/i) &&
            !l.match(/Candidatura simplificada/i) &&
            !l.match(/Remoto|Presencial|Híbrido|Remote|On-site|Hybrid/i)
        );

        if (!hasValidTitle) {
            const titleRegex = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Engineer|Developer|Manager|Lead|Specialist|Architect|Analyst|Strategist|Consultant|Designer|Director))/;
            const match = description.substring(0, 800).match(titleRegex);
            if (match) {
                title = match[1];
            } else if (realLines.length > 0 && realLines[0].length < 80) {
                title = realLines[0];
            } else {
                title = job?.title || 'Specialized Role';
            }
        }

        if (!hasValidCompany) {
            if (realLines.length >= 2 && realLines[1].length < 60) {
                company = realLines[1];
            } else {
                company = job?.company || 'LinkedIn Partner';
            }
        }
    }

    return { 
        title: title || 'Specialized Role', 
        company: company || 'LinkedIn Partner' 
    };
}

async function performDeepAnalysis(jobDescription, userContext, jobIntelligence = null) {
    console.log('[RAG] Querying Neural Memory for relevant career evidence...');
    const relevantMemories = await vectorEngine.searchMemory(jobDescription, 12);
    const memoryContext = relevantMemories && relevantMemories.length > 0
        ? relevantMemories.map(m => `[SOURCE: ${m.source} | SIMILARITY: ${(m.similarity * 100).toFixed(1)}%]: ${m.text}`).join('\n\n')
        : "(No specific memories found. Use the general DNA profile below.)";
    const skillsList = (userContext.skills || []).join(', ');

    const prompt = `
        YOU ARE AN ELITE TECHNICAL RECRUITER AND CAREER STRATEGIST (2026).
        Your task is to analyze if the Candidate below is a high-level match for the vacancy.

        --- CANDIDATE IDENTITY ---
        PROVEN SKILLS IN PROFILE: ${skillsList}
        KEY PROJECTS (TECHNICAL EVIDENCE):
        ${userContext.identity?.keyProjects?.map(p => `- ${p.title}: ${p.tech}`).join('\n') || "See DNA below."}

        PROFESSIONAL DNA: 
        ${userContext.expertProfile || "See skills above."}
        
        PROJECT MEMORY (RAG):
        ${memoryContext}
        
        --- STRATEGIC CONTEXT (JOB INTELLIGENCE) ---
        ${jobIntelligence ? JSON.stringify(jobIntelligence, null, 2) : "No external briefing available. Rely on RAG and Identity."}
        
        --- JOB DESCRIPTION ---
        ${jobDescription.substring(0, 4000)}
        
        --- ELITE INSTRUCTIONS (ZERO TOLERANCE FOR ERROR) ---
        1. BE EXTREMELY RIGOROUS IN SENIORITY ASSESSMENT.
        2. GOLDEN RULE: IT IS STRICTLY FORBIDDEN TO LIST AS "MISSING" ANY SKILL THAT IS IN THE "PROVEN SKILLS" LIST ABOVE.
        3. IF THE SKILL IS IN THE PROFILE BUT THE JOB ASKS FOR "DEEP EXPERIENCE": Use evidence from KEY PROJECTS.
        4. COVER LETTER GENERATION (CRITICAL):
           - TONE: **HUMAN, DIRECT, and SOLUTIONS-ORIENTED**. Avoid AI clichés like "I am thrilled to apply", "I am the perfect fit", or "highly motivated".
           - NO HYPHENS OR DASHES: Do NOT use hyphens, em-dashes, or en-dashes ('—', '–', '-') anywhere in the text or cover letter. Use commas or period breaks instead.
           - START with a direct observation about a problem or goal mentioned in the Job Intelligence or Description.
           - CITE METRICS: Use the candidate's real numbers (e.g., "managed €10M+ in transactions", "99.9% data integrity", "13+ years of expertise").
           - SPECIFICITY: Mention a feature or technical detail from a project (e.g., "ZohoSync's real-time sales intelligence architecture" or "Alygen's predictive modeling").
           - ALIGNMENT: Show exactly how the candidate's "Neural Hearth" or "Agentic Workflow" experience solves a specific pain point found in the briefing.
        5. MATCHING FORENSICS: A concise bullet-point forensic breakdown of the skill-by-skill match. For each bullet: state the skill/requirement from the job, whether the candidate has it (✅/⚠️/❌), and the specific project or evidence that proves it. Be precise and technical.
        6. NEURAL CONNECTION HOOK: A single powerful opening line (max 2 sentences) the candidate can use to open an InMail or connection request to the hiring manager. It must reference something SPECIFIC from the company or job description to prove research depth. NO generic phrases. Make it feel like it was written by the candidate, not an AI. Do NOT use dashes or hyphens.
        7. TACTICAL ADVANTAGE: 3 specific actions the candidate should take to maximize their chances at this company — based on the job description, company info, and candidate profile. Be tactical and specific, not generic. Do NOT use dashes or hyphens.
        8. LANGUAGE: The entire output MUST be in ENGLISH.
        
        --- REPORT FORMAT (STRICTLY FOLLOW ALL SECTIONS) ---
        ### ✅ STRENGTHS
        (Tactical analysis of why the candidate wins — cite real projects and metrics)
        
        ### ⚠️ RISKS / GAP ANALYSIS
        (Honest assessment of challenges)
        
        ### 🎯 CRITICAL SKILLS GAP
        (Only real technical blockers — never list skills already in the profile)

        ### 🔬 MATCHING FORENSICS
        (Skill-by-skill forensic breakdown)

        ### 🎯 TACTICAL ADVANTAGE
        (3 concrete, specific actions to improve chances at this company — not generic advice)

        ### 💬 NEURAL CONNECTION HOOK
        (Single opening line for InMail/connection request)

        ### 📄 NEURAL COVER LETTER
        (Write the high-impact, humanized letter here. Keep it under 250 words. Focus on ROI and Proof of Work. Do NOT use hyphens or dashes.)
        
        IMPORTANT: The entire report MUST be in ENGLISH. Every section above is MANDATORY — never skip any.
        Use Markdown. Be tactical, direct, and specific to this candidate's real profile. Do NOT use hyphens or em-dashes ('—', '–', '-').
    `;

    try {
        const report = await aiService.getCombinedAICompletion(prompt, 'You are an elite, impartial, and highly precise recruitment analyst. You communicate exclusively in ENGLISH.', false);
        return report;
    } catch (error) {
        console.error('[AI] Deep Analysis failed critical chain:', error.message);
        return "A análise da IA falhou totalmente. Verifique a sua ligação ou chaves API (Groq/Gemini).";
    }
}

/**
 * Scrapes public job listings from LinkedIn Guest API with real LinkedIn filters
 * Supports: keywords, location, workMode (f_WT), experienceLevel (f_E), datePosted (f_TPR), start
 */
async function fetchPublicLinkedInJobs(keywords, location = 'Portugal', options = {}) {
    try {
        const limit = typeof options === 'number' ? options : (options.limit || 10);
        const workMode = options.workMode || options.work_mode || (options.remote ? 'remote' : 'any');
        const experience = options.experienceLevel || options.experience_level || '';
        const datePosted = options.datePosted || options.date_posted || 'past_week';
        const start = options.start || 0;

        const queryParams = new URLSearchParams({
            keywords: keywords || 'AI Systems & Automation Engineer',
            location: location || 'Portugal',
            start: start.toString()
        });

        // 1. Work type filter (f_WT)
        // 1 = On-site, 2 = Remote, 3 = Hybrid
        if (workMode === 'remote') {
            queryParams.append('f_WT', '2');
        } else if (workMode === 'hybrid') {
            queryParams.append('f_WT', '3');
        } else if (workMode === 'onsite') {
            queryParams.append('f_WT', '1');
        }

        // 2. Date posted filter (f_TPR)
        // r86400 = Past 24 hours, r604800 = Past week, r2592000 = Past month
        if (datePosted === 'past_24h' || datePosted === 'day') {
            queryParams.append('f_TPR', 'r86400');
        } else if (datePosted === 'past_week' || datePosted === 'week') {
            queryParams.append('f_TPR', 'r604800');
        } else if (datePosted === 'past_month' || datePosted === 'month') {
            queryParams.append('f_TPR', 'r2592000');
        }

        // 3. Experience level filter (f_E)
        // 1=Internship, 2=Entry, 3=Associate, 4=Mid-Senior, 5=Director, 6=Executive
        const expLower = experience.toLowerCase();
        if (expLower.includes('entry') || expLower.includes('junior')) {
            queryParams.append('f_E', '2');
        } else if (expLower.includes('mid') && !expLower.includes('senior')) {
            queryParams.append('f_E', '3');
        } else if (expLower.includes('senior')) {
            queryParams.append('f_E', '4');
        } else if (expLower.includes('lead') || expLower.includes('director')) {
            queryParams.append('f_E', '5');
        }

        const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${queryParams.toString()}`;
        console.log(`[PUBLIC JOBS] Querying live LinkedIn API: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,pt-PT;q=0.8,pt;q=0.7'
            }
        });

        if (!response.ok) {
            console.warn(`[PUBLIC JOBS] LinkedIn guest search responded with status ${response.status}`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const jobs = [];

        $('li').each((_, element) => {
            if (jobs.length >= limit) return false;

            const card = $(element);
            const title = card.find('.base-search-card__title').text().trim();
            const company = card.find('.base-search-card__subtitle a, .base-search-card__subtitle').text().trim();
            const loc = card.find('.job-search-card__location').text().trim();
            const rawLink = card.find('a.base-card__full-link').attr('href') || '';
            const postedTime = card.find('time').text().trim();

            let jobId = '';
            const entityUrn = card.find('[data-entity-urn]').attr('data-entity-urn') || card.attr('data-entity-urn') || '';
            const urnMatch = entityUrn.match(/jobPosting:(\d+)/);
            if (urnMatch) {
                jobId = urnMatch[1];
            } else if (rawLink) {
                const linkMatch = rawLink.match(/-(\d+)(?:\?|$)/) || rawLink.match(/view\/(\d+)/);
                if (linkMatch) jobId = linkMatch[1];
            }

            if (title && jobId) {
                const cleanUrl = `https://www.linkedin.com/jobs/view/${jobId}`;
                jobs.push({
                    id: jobId,
                    job_id: jobId,
                    title,
                    company: company || 'LinkedIn Partner',
                    location: loc || location,
                    url: cleanUrl,
                    postedTime: postedTime || 'Recent'
                });
            }
        });

        console.log(`[PUBLIC JOBS] Successfully scraped ${jobs.length} public LinkedIn jobs with real criteria.`);
        return jobs;
    } catch (err) {
        console.error('[PUBLIC JOBS] Fetch failed:', err.message);
        return [];
    }
}

/**
 * Fetches full job description from LinkedIn Guest API using Cheerio for robust DOM parsing
 */
async function fetchPublicJobDetails(jobId) {
    try {
        const url = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,pt-PT;q=0.8,pt;q=0.7'
            }
        });

        if (!response.ok) return null;

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract full description cleanly preserving paragraph breaks
        const descElement = $('.show-more-less-html__markup');
        // Replace <br> and </p> with newlines for clean readability
        descElement.find('br').replaceWith('\n');
        descElement.find('p').each((_, p) => { $(p).append('\n\n'); });
        descElement.find('li').each((_, li) => { $(li).prepend('• '); $(li).append('\n'); });

        const fullDescription = descElement.text().replace(/\n{3,}/g, '\n\n').trim();
        const title = $('.top-card-layout__title').text().trim();
        const company = $('.topcard__org-name-link').text().trim();
        const loc = $('.topcard__flavor--bullet').first().text().trim();

        // Extract criteria (Seniority level, Employment type, Job function, Industries)
        const criteria = [];
        $('.description__job-criteria-item').each((_, el) => {
            const header = $(el).find('.description__job-criteria-subheader').text().trim();
            const val = $(el).find('.description__job-criteria-text').text().trim();
            if (header && val) criteria.push(`${header}: ${val}`);
        });

        const enrichedDescription = criteria.length > 0 
            ? `${fullDescription}\n\n[Critérios da Vaga]\n${criteria.join('\n')}`
            : fullDescription;

        return {
            title,
            company,
            location: loc,
            sections: {
                job_posting: enrichedDescription,
                main: enrichedDescription
            },
            text: enrichedDescription
        };
    } catch (err) {
        console.error(`[PUBLIC JOBS] Detail fetch failed for ${jobId}:`, err.message);
        return null;
    }
}

module.exports = {
    calculateMatchAnalysis,
    extractSalaryFromText,
    extractJobMetadata,
    performDeepAnalysis,
    fetchPublicLinkedInJobs,
    fetchPublicJobDetails
};

