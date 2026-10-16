// ============================================================
// 🛡️ API CONTRACT SCHEMAS (Zod Enterprise Validation)
// Strict boundary schemas preventing injection & malformed data
// ============================================================

const { z } = require('zod');

// 1. Job Import Request (URL scraping or text paste)
const JobImportSchema = z.object({
    url: z.string().trim().max(1000).optional().or(z.literal('')),
    title: z.string().trim().max(200).optional(),
    company: z.string().trim().max(200).optional(),
    description: z.string().trim().max(50000).optional().or(z.literal('')),
    location: z.string().trim().max(200).optional()
}).refine(data => {
    const hasUrl = data.url && data.url.length >= 8;
    const hasDesc = data.description && data.description.length >= 10;
    return hasUrl || hasDesc;
}, {
    message: "Must provide either a valid job URL or a job description (minimum 10 characters)."
});

// 2. Autopilot Configuration
const AutopilotConfigSchema = z.object({
    dailyLimit: z.number().int().min(1, 'Daily limit must be at least 1').max(10, 'Daily limit capped at 10'),
    intervalHours: z.number().min(1, 'Interval must be at least 1 hour').max(48, 'Interval capped at 48 hours'),
    maxPages: z.number().int().min(1, 'Scan depth must be at least 1 page').max(10, 'Scan depth capped at 10 pages')
});

// 3. Cookie Configuration (Zero-Trust Session Vault)
const CookieConfigSchema = z.object({
    cookie: z.string().trim().optional(),
    li_at: z.string().trim().optional()
}).refine(data => {
    const val = data.cookie || data.li_at;
    return !!(val && val.length >= 10);
}, {
    message: "A valid cookie token (minimum 10 characters) is required under 'cookie' or 'li_at'."
});

// 4. Portfolio Analysis
const PortfolioAnalyzeSchema = z.object({
    text: z.string().trim().min(5, 'Portfolio text must have at least 5 characters').max(100000, 'Portfolio text exceeds 100k character limit')
});

function normalizeOptionalString(val) {
    if (val === undefined || val === null) return '';
    return String(val).trim();
}

function normalizeJobPostingUrl(val) {
    let s = normalizeOptionalString(val);
    if (!s) return '';
    s = s.replace(/\s+/g, '');
    if (!/^https?:\/\//i.test(s)) {
        s = `https://${s.replace(/^\/+/, '')}`;
    }
    return s.substring(0, 2000);
}

function coerceCvTailorBody(raw) {
    const body = raw && typeof raw === 'object' ? raw : {};
    let jobUrl = normalizeJobPostingUrl(body.jobUrl || body.url);
    let jobDescription = normalizeOptionalString(body.jobDescription);
    if (!jobUrl && jobDescription) {
        const firstToken = jobDescription.split(/\s+/)[0] || '';
        if (/linkedin\.com\/jobs\//i.test(firstToken) || /^jobs\./i.test(firstToken)) {
            jobUrl = normalizeJobPostingUrl(firstToken);
            const rest = jobDescription.slice(firstToken.length).trim();
            jobDescription = rest.length >= 10 ? rest : '';
        }
    }
    return {
        jobDescription,
        jobUrl,
        jobTitle: normalizeOptionalString(body.jobTitle),
        company: normalizeOptionalString(body.company)
    };
}

// 4b. One-page ATS CV tailor (job URL and/or description)
const CvTailorSchema = z
    .preprocess(coerceCvTailorBody, z.object({
        jobDescription: z.string().max(50000),
        jobUrl: z.string().max(2000),
        jobTitle: z.string().max(200),
        company: z.string().max(200)
    }))
    .superRefine((data, ctx) => {
        const hasUrl = Boolean(data.jobUrl && data.jobUrl.length > 8);
        const hasDesc = Boolean(data.jobDescription && data.jobDescription.length >= 10);
        if (!hasUrl && !hasDesc) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Provide a job posting URL or paste a description (min 10 characters).',
                path: ['jobDescription']
            });
        }
        if (data.jobUrl && data.jobUrl.length > 8) {
            try {
                const parsed = new URL(data.jobUrl);
                if (!['http:', 'https:'].includes(parsed.protocol)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Job URL must use http or https.',
                        path: ['jobUrl']
                    });
                }
            } catch {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Invalid job URL. Example: https://www.linkedin.com/jobs/view/1234567890',
                    path: ['jobUrl']
                });
            }
        }
    });

// 5. Bio Generation
const BioGenerateSchema = z.object({
    prompt: z.string().trim().max(5000).optional().or(z.literal('')),
    tone: z.enum(['professional', 'concise', 'bold', 'creative', 'cyberpunk']).optional()
});

// 6. Vision Engine Action
const VisionActSchema = z.object({
    action: z.string().trim().min(2, 'Action description required').max(1000)
});

// 7. Core Job Deep Intelligence Schema (For closed loop safety)
const DeepIntelligenceSchema = z.object({
    score: z.number().min(0).max(100),
    summary: z.string().min(5),
    attack_strategy: z.string().optional(),
    intelligence_report: z.string().optional(),
    forensics_report: z.string().optional(),
    company_intel: z.string().optional(),
    strategy_analysis: z.string().optional(),
    pitch_message: z.string().optional(),
    linkedin_connect_note: z.string().optional(),
    inmail_pitch: z.string().optional(),
    detected_language: z.string().optional().default('en'),
    matched_skills: z.array(z.string()).optional().default([]),
    skills_gaps: z.array(z.string()).optional().default([])
});

const IngestProjectSchema = z.object({
    title: z.string().trim().min(2).max(200),
    context: z.string().trim().max(4000).optional().or(z.literal('')),
    role: z.string().trim().max(2000).optional().or(z.literal('')),
    stack: z.string().trim().max(1000).optional().or(z.literal('')),
    result: z.string().trim().max(2000).optional().or(z.literal('')),
    link: z.string().trim().max(1000).optional().or(z.literal('')),
    period: z.string().trim().max(80).optional().or(z.literal('')),
    company: z.string().trim().max(200).optional().or(z.literal('')),
    attach_to_experience: z.boolean().optional()
});

const IngestExperienceSchema = z.object({
    company: z.string().trim().min(2).max(200),
    role: z.string().trim().min(2).max(200),
    period: z.string().trim().max(80).optional().or(z.literal('')),
    bullet: z.string().trim().min(10).max(2000)
});

const IngestLessonSchema = z.object({
    text: z.string().trim().min(5).max(100000),
    kind: z.enum(['project_notes', 'preferences', 'screening']).optional().default('project_notes')
});

module.exports = {
    JobImportSchema,
    AutopilotConfigSchema,
    CookieConfigSchema,
    PortfolioAnalyzeSchema,
    CvTailorSchema,
    BioGenerateSchema,
    VisionActSchema,
    DeepIntelligenceSchema,
    IngestProjectSchema,
    IngestExperienceSchema,
    IngestLessonSchema
};
