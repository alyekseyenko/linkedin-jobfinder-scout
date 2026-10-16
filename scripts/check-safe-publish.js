#!/usr/bin/env node
/**
 * Pre-push guard: scan git-tracked files for common secret patterns and blocked paths.
 * Usage: node scripts/check-safe-publish.js
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const BLOCKED_PATH_RE = [
    /^\.env$/i,
    /^backend\/user_cv\.json$/i,
    /^backend\/user_cv\.json\.real_backup$/i,
    /real_backup/i,
    /^backend\/cookies\.json$/i,
    /^backend\/knowledge_base\.json$/i,
    /^backend\/vault\//i,
    /\.enc$/i
];

const SECRET_PATTERNS = [
    { name: 'Groq API key', re: /gsk_[A-Za-z0-9]{20,}/ },
    { name: 'Google API key', re: /AIza[A-Za-z0-9_-]{30,}/ },
    { name: 'OpenAI-style key', re: /sk-[A-Za-z0-9]{20,}/ },
    { name: 'LinkedIn li_at blob', re: /AQEDA[A-Za-z0-9%+/=]{40,}/ },
    {
        name: 'Non-demo DB URL with password',
        re: /postgresql:\/\/(?!neural:neural@)[^:\s]+:[^@\s]+@/i
    }
];

function listTrackedFiles() {
    const out = execSync('git ls-files -z', { cwd: ROOT, encoding: 'buffer' });
    return out
        .toString('utf8')
        .split('\0')
        .filter(Boolean);
}

function main() {
    const files = listTrackedFiles();
    let failed = false;

    for (const rel of files) {
        const norm = rel.replace(/\\/g, '/');
        if (BLOCKED_PATH_RE.some((re) => re.test(norm))) {
            console.error(`❌ Blocked path is tracked by git: ${norm}`);
            failed = true;
        }
    }

    for (const rel of files) {
        const abs = path.join(ROOT, rel);
        let text;
        try {
            const buf = fs.readFileSync(abs);
            if (buf.includes(0)) continue;
            text = buf.toString('utf8');
        } catch {
            continue;
        }
        for (const { name, re } of SECRET_PATTERNS) {
            if (re.test(text)) {
                console.error(`❌ Possible ${name} in tracked file: ${rel}`);
                failed = true;
            }
        }
    }

    if (failed) {
        console.error('\nFix issues before pushing. See README § "Publicar no GitHub com segurança".');
        process.exit(1);
    }
    console.log(`✅ Safe-publish check passed (${files.length} tracked files).`);
}

main();
