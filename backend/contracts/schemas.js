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

module.exports = {
    JobImportSchema,
    AutopilotConfigSchema,
    CookieConfigSchema,
    PortfolioAnalyzeSchema,
    BioGenerateSchema,
    VisionActSchema,
    DeepIntelligenceSchema
};
