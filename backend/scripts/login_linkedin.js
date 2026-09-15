// ============================================================
// 🔑 LINKEDIN 1-CLICK AUTHENTICATION SCRIPT
// Abre o Google Chrome no Windows numa sessão limpa e independente.
// Captura automaticamente o cookie li_at e sincroniza com o backend.
// ============================================================

const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const http = require('http');

(async () => {
    // Usar pasta temporária única para nunca colidir com locks do Docker
    const profileDir = path.join(os.tmpdir(), `neural_chrome_login_${Date.now()}`);
    const backendUrl = 'http://127.0.0.1:3004';

    console.log('====================================================');
    console.log('🌐 A ABRIR GOOGLE CHROME PARA AUTENTICAÇÃO LINKEDIN');
    console.log('👉 Faz login normalmente na janela que vai abrir.');
    console.log('👉 O sistema irá capturar o teu cookie li_at automaticamente!');
    console.log('====================================================\n');

    try {
        const context = await chromium.launchPersistentContext(profileDir, {
            headless: false,
            channel: 'chrome',
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-first-run',
                '--no-default-browser-check',
                '--start-maximized'
            ],
            viewport: null
        });

        const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
        
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
        console.log('✅ Janela aberta com sucesso. A monitorizar início de sessão...');

        // Polling para apanhar o cookie li_at quando o utilizador estiver realmente dentro do LinkedIn
        let captured = false;
        const pollInterval = setInterval(async () => {
            try {
                const currentUrl = page.url();
                const isInside = currentUrl.includes('/feed') || 
                                 currentUrl.includes('/mynetwork') || 
                                 currentUrl.includes('/jobs') ||
                                 currentUrl.includes('/in/') ||
                                 currentUrl.includes('/dashboard');

                // Só capturar quando a navegação sair do ecrã de login/checkpoint e estiver dentro do feed
                if (isInside && !captured) {
                    const cookies = await context.cookies(['https://www.linkedin.com', 'https://linkedin.com']);
                    const liAt = cookies.find(c => c.name === 'li_at');

                    if (liAt && liAt.value && liAt.value.length > 20) {
                        captured = true;
                        console.log('\n🎯 SUCESSO! Sessão autenticada ativa detetada no Feed do LinkedIn!');
                        clearInterval(pollInterval);

                        // Sincronizar com o backend com todo o pacote de cookies
                        const postData = JSON.stringify({ 
                            token: liAt.value,
                            allCookies: cookies 
                        });
                        const req = http.request(`${backendUrl}/api/auth/linkedin/token`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Content-Length': Buffer.byteLength(postData)
                            }
                        }, (res) => {
                            console.log('🔒 Sessão persistida com sucesso e gravada permanentemente no Vault e .env!');
                            console.log('✅ A partir de agora o teu login está guardado permanentemente para todas as candidaturas!');
                            console.log('🎉 Podes fechar esta janela do Chrome quando quiseres.');
                        });
                        req.on('error', (e) => console.error('Erro de envio:', e.message));
                        req.write(postData);
                        req.end();

                        // Manter a janela aberta por 8 segundos para não interromper bruscamente
                        setTimeout(async () => {
                            try {
                                await context.close();
                            } catch (_) {}
                            process.exit(0);
                        }, 8000);
                    }
                }
            } catch (_) {}
        }, 1000);

        // Esperar que o utilizador feche o navegador manualmente
        page.on('close', async () => {
            clearInterval(pollInterval);
            if (!captured) {
                console.log('🔒 Janela terminada pelo utilizador.');
                process.exit(0);
            }
        });

    } catch (err) {
        console.error('❌ Erro ao abrir Chrome:', err.message);
        process.exit(1);
    }
})();
