#!/usr/bin/env node
/**
 * Usage:
 *   node scripts/ingest_local_repo.js "C:\path\to\habitarmos-phc-replica"
 *   node scripts/ingest_local_repo.js "C:\path\to\repo" --project-id phc_cloud_data_platform_elt
 *   node scripts/ingest_local_repo.js "C:\path\to\repo" --extra "C:\Desktop\Nova pasta\agent-id"
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const vectorEngine = require('../vector_engine');
const knowledgeService = require('../services/knowledge_service');

function parseArgs(argv) {
    const repoPath = argv[2];
    const options = { projectId: 'phc_cloud_data_platform_elt', agentIds: [], extraDirs: [] };
    for (let i = 3; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--project-id' && argv[i + 1]) {
            options.projectId = argv[++i];
        } else if (a === '--agent-id' && argv[i + 1]) {
            options.agentIds.push(argv[++i]);
        } else if (a === '--extra' && argv[i + 1]) {
            options.extraDirs.push(argv[++i]);
        }
    }
    return { repoPath, options };
}

async function main() {
    const { repoPath, options } = parseArgs(process.argv);
    if (!repoPath) {
        console.error('Usage: node scripts/ingest_local_repo.js <repoPath> [--project-id id] [--agent-id uuid] [--extra dir]');
        process.exit(1);
    }

    await vectorEngine.initVectorEngine();
    const result = await knowledgeService.ingestLocalProjectRepo(repoPath, options);
    console.log('[INGEST REPO] Done:', JSON.stringify(result, null, 2));
    process.exit(0);
}

main().catch((e) => {
    console.error('[INGEST REPO] Failed:', e.message);
    process.exit(1);
});
