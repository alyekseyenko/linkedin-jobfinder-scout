// ============================================================
// 🖥️ NATIVE WINDOWS DESKTOP AUTOFILL RUNNER (HITL)
// Launches native Google Chrome directly on your Windows desktop
// with visible interaction and Human-in-the-Loop review
// ============================================================

const autofillService = require('../services/autofill_service');

const jobId = process.argv[2] || '4127027598';
const jobUrl = process.argv[3] || `https://www.linkedin.com/jobs/view/${jobId}`;

// Force visible desktop window
process.env.HEADLESS = 'false';

console.log('====================================================');
console.log('🚀 INICIANDO AUTO-FILL COM JANELA FÍSICA NO WINDOWS');
console.log(`🎯 Vaga: ${jobId}`);
console.log(`🌐 URL:  ${jobUrl}`);
console.log('🛑 Regra: A IA vai parar antes de submeter (HITL)');
console.log('====================================================');

(async () => {
    try {
        await autofillService.startAutofill({ jobId, jobUrl });
        
        // Monitor in console
        const poll = setInterval(() => {
            const status = autofillService.getSessionStatus(jobId);
            if (status.logs && status.logs.length > 0) {
                const latest = status.logs[status.logs.length - 1];
                console.log(latest);
            }
            if (status.readyForReview) {
                console.log('\n====================================================');
                console.log('🟢 CANDIDATURA PREENCHIDA COM SUCESSO!');
                console.log('👉 A janela do Chrome está aberta à tua frente.');
                console.log('👉 Por favor revê os dados e clica em "Enviar" manualmente.');
                console.log('====================================================\n');
                clearInterval(poll);
            }
            if (status.status === 'error') {
                console.error('\n❌ Erro:', status.error);
                clearInterval(poll);
            }
        }, 1500);
    } catch (e) {
        console.error('Falha:', e.message);
    }
})();
