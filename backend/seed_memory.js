const fs = require('fs');
const path = require('path');
const { initVectorEngine, addInformation } = require('./vector_engine');

const KB_PATH = path.join(__dirname, 'knowledge_base.json');

async function seed() {
    console.log('🚀 Iniciando Migração de DNA (JSON -> Vetores)...');
    
    if (!fs.existsSync(KB_PATH)) {
        console.error('❌ Erro: knowledge_base.json não encontrado.');
        return;
    }

    let kb;
    try {
        kb = JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));
    } catch (e) {
        console.error('❌ Erro ao ler JSON:', e.message);
        return;
    }
    
    await initVectorEngine();

    // 1. Migrar Perfil de Especialista
    if (kb.expertProfile) {
        console.log('📦 Processando Expert Profile...');
        await addInformation(kb.expertProfile, 'Migration: Expert Profile');
    }

    // 2. Migrar Identidade Sintetizada
    if (kb.identity) {
        console.log('📦 Processando Neural Identity...');
        const identityText = `Indústria: ${kb.identity.industryNiche || ''}\nNível: ${kb.identity.experienceLevel || ''}\nFilosofia: ${kb.identity.workPhilosophy || ''}`;
        await addInformation(identityText, 'Migration: Neural Identity');
    }

    // 3. Migrar Habilidades
    if (kb.skills && kb.skills.length > 0) {
        console.log(`📦 Processando ${kb.skills.length} Habilidades...`);
        await addInformation(`Habilidades Técnicas: ${kb.skills.join(', ')}`, 'Migration: Technical Skills');
    }

    console.log('\n✅ Migração concluída com sucesso! Sua Memória Neural está ativa.');
    process.exit(0);
}

seed();
