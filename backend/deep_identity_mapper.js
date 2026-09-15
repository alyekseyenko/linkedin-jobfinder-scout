const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Adicionado axios para comunicação com AI Engine
require('dotenv').config();

const KB_PATH = path.join(__dirname, 'knowledge_base.json');
const CV_PATH = path.join(__dirname, 'user_cv.json');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function performDeepMapping() {
    console.log('🚀 [DEEP MAPPING] Iniciando Ingestão de Identidade Neural 2.0...');
    
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    let kb = {};
    let cv = {};
    if (fs.existsSync(KB_PATH)) kb = JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));
    if (fs.existsSync(CV_PATH)) cv = JSON.parse(fs.readFileSync(CV_PATH, 'utf8'));

    const rawData = `
    KNOWLEDGE BASE ACTUAL:
    ${JSON.stringify(kb.identity || {}, null, 2)}
    USER CV DATA:
    ${JSON.stringify(cv, null, 2)}
    `;

    const prompt = `
    Você é um Arquiteto de Identidade Neural de Elite (2026).
    Seu objetivo é processar o histórico do usuário e criar um Grafo de Conhecimento Estruturado.
    DADOS BRUTOS:
    ${rawData.substring(0, 3000)}
    INSTRUÇÕES:
    1. Identifique ENTIDADES (Empresas, Projetos, Certificados, Habilidades).
    2. Identifique RELACIONAMENTOS.
    3. Extraia métricas de impacto (ROI, orçamentos).
    SAÍDA ESPERADA (JSON PURO):
    {
      "entities": [
        { "id": "node_id", "type": "Project|Skill|Cert", "name": "Name", "details": "..." }
      ],
      "relationships": [
        { "source": "id1", "target": "id2", "relation": "used|proved" }
      ],
      "global_summary": "Summary...",
      "strategic_narrative": "Narrative..."
    }
    `;

    let structuredData = null;
    let success = false;

    // 1. TENTATIVA COM GROQ (Motor de Alta Velocidade)
    if (groqKey) {
        console.log('🏎️ [GROQ] Usando Llama 3 70B para extração instantânea...');
        try {
            const groqResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "Você é um JSON Expert. Responda APENAS com JSON puro." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
                response_format: { type: "json_object" }
            }, {
                headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' }
            });

            structuredData = JSON.parse(groqResponse.data.choices[0].message.content);
            console.log('✅ [GROQ] Extração concluída em segundos.');
            success = true;
        } catch (e) {
            console.warn('⚠️ Groq falhou ou limite atingido. Tentando Gemini...', e.message);
        }
    }

    // 2. FALLBACK COM COHERE (Comunicação Direta via Axios)
    if (!success && process.env.COHERE_API_KEY) {
        console.log('💎 [COHERE] Iniciando extração direta via API (command-r-08-2024)...');
        try {
            console.log('💎 [COHERE] Enviando POST para https://api.cohere.ai/v1/chat...');
            const cohereResponse = await axios.post('https://api.cohere.ai/v1/chat', {
                message: prompt + "\n\nResponda APENAS com o JSON puro, sem explicações.",
                model: 'command-r-08-2024',
                temperature: 0.1
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });
            
            console.log('💎 [COHERE] Resposta recebida da API.');
            const text = cohereResponse.data.text;
            console.log('💎 [COHERE] Texto da resposta (primeiros 100 caracteres):', text.substring(0, 100));
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            structuredData = JSON.parse(jsonMatch ? jsonMatch[0] : text);
            success = true;
            console.log('✅ [COHERE] Extração concluída com sucesso.');
        } catch (e) {
            console.error('❌ Cohere API falhou:', e.message);
            if (e.response && e.response.data) console.error('❌ Resposta da API Cohere:', JSON.stringify(e.response.data));
        }
    }

    // 3. FALLBACK COM GEMINI (Se Groq e Cohere falharem)
    if (!success && geminiKey) {
        console.log('🧠 [GEMINI] Usando Gemini 3.5 Flash como motor de backup...');
        const genAI = new GoogleGenerativeAI(geminiKey);
        for (const m of ['gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.6-flash']) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                structuredData = JSON.parse(jsonMatch ? jsonMatch[0] : text);
                success = true;
                console.log(`✅ [GEMINI] Extração concluída com ${m}.`);
                break;
            } catch (error) {
                console.warn(`⚠️ Gemini (${m}) falhou:`, error.message);
            }
        }
    }

    // 3. FALLBACK COM COHERE (Se Gemini e Groq falharem)
    if (!success && process.env.COHERE_API_KEY) {
        console.log('💎 [COHERE] Usando Cohere Command R para extração de segurança...');
        try {
            const { CohereClient } = require('cohere-ai');
            const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
            
            const response = await cohere.chat({
                message: prompt + "\n\nResponda APENAS com o JSON puro, sem explicações.",
                model: 'command-r-08-2024'
            });
            
            const text = response.text;
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            structuredData = JSON.parse(jsonMatch ? jsonMatch[0] : text);
            success = true;
            console.log('✅ [COHERE] Extração concluída com sucesso.');
        } catch (e) {
            console.error('❌ Cohere também falhou:', e.message);
        }
    }
    
    if (!success) {
        console.error('❌ Abortando Deep Mapping após várias tentativas.');
        return;
    }

    try {
        fs.writeFileSync(path.join(__dirname, 'neural_graph_data.json'), JSON.stringify(structuredData, null, 2));
        console.log('✅ [DEEP MAPPING] JSON gerado localmente.');

        // 2. Ingerir no Grafo de Conhecimento (Python AI Engine)
        console.log('🧠 [GRAPH] Enviando dados para o Python LightRAG Engine...');
        
        // Ingerir resumo global como o "Coração" do grafo
        await axios.post('http://127.0.0.1:8001/graph/ingest', {
            text: `IDENTIDADE MESTRE 2026: ${structuredData.global_summary}. NARRATIVA: ${structuredData.strategic_narrative}`
        }).catch(e => console.warn('⚠️ Falha ao ingerir Resumo Global no Grafo.'));

        // Ingerir entidades principais (em lotes suavizados)
        console.log('🧪 [GRAPH] Ingerindo as 5 entidades top de forma ultra-suave...');
        for (const entity of structuredData.entities.slice(0, 5)) {
            await axios.post('http://127.0.0.1:8001/graph/ingest', {
                text: `ENTIDADE: ${entity.name} (${entity.type}). DETALHES: ${entity.details}`
            }).catch(e => {});
            await sleep(3000); // 3 segundos entre cada para evitar erro 10055
        }

        console.log('🏆 [DEEP MAPPING] Sincronização Neural Completa!');
        
        // NOVO: Atualizar a Knowledge Base global para que o Dashboard pare de pollar e mostre os resultados
        if (fs.existsSync(KB_PATH)) {
            const kbData = JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));
            kbData.identity.summary = structuredData.global_summary;
            kbData.identity.techPhilosophy = structuredData.strategic_narrative;
            kbData.lastUpdated = new Date().toISOString();
            fs.writeFileSync(KB_PATH, JSON.stringify(kbData, null, 2));
            console.log('✅ [KB UPDATE] Identidade mestre atualizada com sucesso.');
        }
        
    } catch (error) {
        console.error('❌ Erro na finalização do mapeamento:', error.message);
    }
}

performDeepMapping();
