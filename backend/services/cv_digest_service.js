// Structured CV facts for LangGraph agents (no route coupling)
const fs = require('fs');
const path = require('path');
const knowledgeService = require('./knowledge_service');

function tokenizeForJdMatch(text) {
    return (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9+#./\s-]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2);
}

function jdOverlapScore(blob, jobText) {
    const jobTokens = tokenizeForJdMatch(jobText);
    if (!jobTokens.length) return 0;
    const blobStr = typeof blob === 'string' ? blob : JSON.stringify(blob);
    const blobTokens = tokenizeForJdMatch(blobStr);
    let hits = 0;
    for (const t of blobTokens) {
        if (jobTokens.some((jt) => jt === t || jt.includes(t) || t.includes(jt))) hits++;
    }
    return hits;
}

function flattenProjectTech(project) {
    const out = [];
    if (Array.isArray(project.technologies)) out.push(...project.technologies);
    if (Array.isArray(project.tech_stack)) out.push(...project.tech_stack);
    if (project.tech_stack && typeof project.tech_stack === 'object' && !Array.isArray(project.tech_stack)) {
        Object.values(project.tech_stack).forEach((v) => {
            if (Array.isArray(v)) out.push(...v);
            else if (typeof v === 'string') out.push(v);
        });
    }
    if (Array.isArray(project.edges_skills)) out.push(...project.edges_skills);
    const seen = new Set();
    const unique = [];
    for (const item of out) {
        const s = String(item).trim();
        if (!s) continue;
        const key = s.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(s);
        }
    }
    return unique.slice(0, 20);
}

function loadMasterCv() {
    const cvPath = path.join(__dirname, '..', 'user_cv.json');
    const examplePath = path.join(__dirname, '..', 'user_cv.json.example');
    const activePath = fs.existsSync(cvPath) ? cvPath : (fs.existsSync(examplePath) ? examplePath : null);
    if (!activePath) return {};
    return JSON.parse(fs.readFileSync(activePath, 'utf8'));
}

/**
 * Short factual digest for agent prompts (ranked by job context).
 */
function buildCandidateDigest(jobContext = {}) {
    const master = loadMasterCv();
    const kb = knowledgeService.knowledgeBase || {};
    const identity = kb.identity || {};
    const jdText = `${jobContext.jobTitle || ''} ${jobContext.jobDescription || ''}`;
    const priorityBoost = { flagship: 15, high: 8 };

    const projects = knowledgeService.mergeProjects(master.projects, identity.relationalProjects)
        .filter((p) => p && p.portfolio_priority !== 'low')
        .sort((a, b) => {
            const scoreA = jdOverlapScore(a, jdText) + (priorityBoost[a.portfolio_priority] || 0);
            const scoreB = jdOverlapScore(b, jdText) + (priorityBoost[b.portfolio_priority] || 0);
            return scoreB - scoreA;
        })
        .slice(0, 4)
        .map((p) => ({
            title: p.title || p.name,
            company: p.company,
            context: (p.context || p.description || '').substring(0, 400),
            bullets: (p.bullets || p.implementation_highlights || []).slice(0, 5),
            outcomes: (p.edges_outcomes || p.outcomes || []).slice(0, 4),
            tech: flattenProjectTech(p)
        }));

    const experience = (master.experience || [])
        .sort((a, b) => {
            const blobA = `${a.role} ${a.company} ${(a.bullets || []).join(' ')}`;
            const blobB = `${b.role} ${b.company} ${(b.bullets || []).join(' ')}`;
            return jdOverlapScore(blobB, jdText) - jdOverlapScore(blobA, jdText);
        })
        .slice(0, 4)
        .map((exp) => ({
            company: exp.company,
            role: exp.role,
            period: exp.period,
            bullets: (exp.bullets || []).slice(0, 4)
        }));

    const hardSkills = Array.isArray(master.hard_skills)
        ? master.hard_skills
        : (identity.topSkills || kb.skills || []);

    return {
        personal_info: master.personal_info || identity.personal_info || {},
        summary: (master.summary || identity.summary || '').substring(0, 900),
        experience,
        projects,
        hard_skills: hardSkills.slice(0, 40),
        soft_skills: (master.soft_skills || identity.softSkills || []).slice(0, 18),
        operational_metrics: master.operational_metrics || identity.operational_metrics || null,
        dev_tooling: master.dev_tooling || null,
        education: (master.education || identity.education || []).slice(0, 4),
        certifications: (master.certifications || identity.certifications || []).slice(0, 8)
    };
}

/**
 * UI-facing summary: how vector memory + digest align with the job (no secrets).
 */
function buildAtsContextInsights(jobContext = {}, memoryFragments = [], digest = null) {
    const jdText = `${jobContext.jobTitle || ''} ${jobContext.jobDescription || ''}`;
    const master = loadMasterCv();
    const allProjects = knowledgeService.mergeProjects(
        master.projects,
        (knowledgeService.knowledgeBase || {}).identity?.relationalProjects
    );

    const priorityBoost = { flagship: 15, high: 8 };
    const ranked_projects = allProjects
        .filter((p) => p && p.portfolio_priority !== 'low')
        .map((p) => {
            const jdScore = jdOverlapScore(p, jdText);
            const boost = priorityBoost[p.portfolio_priority] || 0;
            const blob = `${p.context || ''} ${(p.bullets || []).join(' ')}`;
            return {
                title: p.title || p.name || 'Project',
                company: p.company || '',
                portfolio_priority: p.portfolio_priority || 'standard',
                relevance_score: jdScore + boost,
                period: p.period || '',
                repository: p.repository || '',
                tech: flattenProjectTech(p).slice(0, 6),
                highlight: blob.substring(0, 120)
            };
        })
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, 5);

    const memory_hits = (memoryFragments || [])
        .slice(0, 8)
        .map((m) => ({
            source: m.source || 'candidate_memory',
            similarity_percent: Math.min(99, Math.max(0, Math.round((m.similarity || 0) * 100))),
            snippet: String(m.text || '')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 240)
        }))
        .filter((m) => m.snippet.length > 20);

    const experience_focus = (digest?.experience || master.experience || [])
        .slice(0, 4)
        .map((e) => ({
            company: e.company,
            role: e.role,
            period: e.period
        }));

    const metrics = digest?.operational_metrics || master.operational_metrics || null;
    const metric_highlights = [];
    if (metrics) {
        if (metrics.n8n_executions_last_7_days) {
            metric_highlights.push(`n8n: ~${metrics.n8n_executions_last_7_days.toLocaleString('en-US')} runs / 7 days`);
        }
        if (metrics.n8n_production_workflows) {
            metric_highlights.push(`${metrics.n8n_production_workflows} production workflows`);
        }
        if (metrics.phc_erp_combined_base_tables) {
            metric_highlights.push(`PHC ELT scope: ~${metrics.phc_erp_combined_base_tables.toLocaleString('en-US')} tables (twin DBs)`);
        }
    }

    return {
        vector_memory_count: memory_hits.length,
        memory_hits,
        ranked_projects,
        experience_focus,
        metric_highlights: metric_highlights.slice(0, 4),
        data_sources: [
            'Master CV (user_cv.json)',
            'Knowledge base identity & projects',
            memory_hits.length ? `PostgreSQL pgvector candidate_memory (${memory_hits.length} hits)` : 'Vector memory (no strong hits — CV + KB only)',
            'Scout + Strategist agent briefing'
        ]
    };
}

module.exports = {
    buildCandidateDigest,
    buildAtsContextInsights
};
