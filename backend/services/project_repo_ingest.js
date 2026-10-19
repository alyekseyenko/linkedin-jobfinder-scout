/**
 * Ingest markdown documentation from a local project repo into CV + pgvector memory.
 * Never reads .env, artifacts/, or binary secrets.
 */
const fs = require('fs');
const path = require('path');

const MAX_FILE_BYTES = 120_000;
const MAX_TOTAL_CHARS = 90_000;

const BLOCKED_PATH_RE =
    /(^|[\\/])\.env(\.|$)|[\\/]artifacts[\\/]|[\\/]node_modules[\\/]|[\\/]venv[\\/]|\.pem$|credentials/i;

const SECRET_LINE_RE = [
    /password\s*[:=]\s*\S+/gi,
    /api[_-]?key\s*[:=]\s*\S+/gi,
    /Bearer\s+[A-Za-z0-9._-]+/gi,
    /gsk_[A-Za-z0-9]+/g,
    /AIza[A-Za-z0-9_-]{20,}/g,
    /sk-[A-Za-z0-9]{20,}/g,
    /li_at=[A-Za-z0-9%+/=]+/gi
];

function scrubSensitiveText(text) {
    let out = String(text || '');
    for (const re of SECRET_LINE_RE) {
        out = out.replace(re, '[REDACTED]');
    }
    return out;
}

function isSafeRelativeDoc(relPath) {
    const norm = relPath.replace(/\\/g, '/');
    if (BLOCKED_PATH_RE.test(norm)) return false;
    if (!/\.(md|txt)$/i.test(norm)) return false;
    if (norm.startsWith('docs/')) return true;
    if (norm === 'README.md' || norm === 'PORTABILITY_GUIDE.md') return true;
    if (norm.startsWith('agent/') && /\.md$/i.test(norm)) return true;
    return false;
}

function walkMarkdownDocs(rootDir, acc = [], base = rootDir) {
    if (!fs.existsSync(rootDir)) return acc;
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const ent of entries) {
        const full = path.join(rootDir, ent.name);
        const rel = path.relative(base, full).replace(/\\/g, '/');
        if (ent.isDirectory()) {
            if (/^(artifacts|node_modules|venv|\.git|dist|build)$/i.test(ent.name)) continue;
            walkMarkdownDocs(full, acc, base);
            continue;
        }
        if (!isSafeRelativeDoc(rel)) continue;
        const stat = fs.statSync(full);
        if (stat.size > MAX_FILE_BYTES) continue;
        const body = scrubSensitiveText(fs.readFileSync(full, 'utf8'));
        acc.push({ relative: rel, body });
    }
    return acc;
}

function collectAgentExportDocs(exportDir) {
    const out = [];
    if (!exportDir || !fs.existsSync(exportDir)) return out;
    const entries = fs.readdirSync(exportDir, { withFileTypes: true });
    for (const ent of entries) {
        const full = path.join(exportDir, ent.name);
        if (ent.isDirectory()) {
            out.push(...collectAgentExportDocs(full));
            continue;
        }
        if (!/\.(md|txt)$/i.test(ent.name)) continue;
        if (BLOCKED_PATH_RE.test(full)) continue;
        const stat = fs.statSync(full);
        if (stat.size > MAX_FILE_BYTES) continue;
        const rel = path.relative(exportDir, full).replace(/\\/g, '/');
        out.push({
            relative: `agent-export/${rel}`,
            body: scrubSensitiveText(fs.readFileSync(full, 'utf8'))
        });
    }
    return out;
}

function buildCorpus(chunks, meta = {}) {
    const header = [
        '# Local project knowledge ingest',
        meta.projectId ? `Project ID: ${meta.projectId}` : '',
        meta.agentIds?.length ? `Agent refs: ${meta.agentIds.join(', ')}` : '',
        meta.repoPath ? `Repo: ${path.basename(meta.repoPath)}` : '',
        ''
    ]
        .filter(Boolean)
        .join('\n');

    let corpus = header;
    for (const c of chunks) {
        const block = `\n\n## ${c.relative}\n\n${c.body}`;
        if (corpus.length + block.length > MAX_TOTAL_CHARS) break;
        corpus += block;
    }
    return corpus.trim();
}

module.exports = {
    scrubSensitiveText,
    walkMarkdownDocs,
    collectAgentExportDocs,
    buildCorpus,
    isSafeRelativeDoc
};
