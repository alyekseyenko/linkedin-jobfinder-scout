// ============================================================
// 🖥️ NEURAL DESKTOP COMPANION (Windows Local Agent)
// Permite que a aplicação Web lance uma janela real do Google Chrome
// para login no LinkedIn e capture o cookie li_at automaticamente.
// ============================================================

const http = require('http');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');

const PORT = 3009;
const BACKEND_URL = 'http://127.0.0.1:3004';

process.on('uncaughtException', (err) => {
    console.log('[COMPANION SAFEGUARD] uncaughtException:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.log('[COMPANION SAFEGUARD] unhandledRejection:', reason?.message || reason);
});

let activeContext = null;
let isLoggingIn = false;

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer(async (req, res) => {
    setCors(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    // 1. Healthcheck
    if (url.pathname === '/health' || url.pathname === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', isLoggingIn }));
        return;
    }

    // 2. Launch LinkedIn Browser Login & Auto-Extract li_at
    if (url.pathname === '/login' && req.method === 'POST') {
        if (isLoggingIn && activeContext) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'A janela de login já se encontra aberta no teu ecrã.' }));
            return;
        }

        isLoggingIn = true;
        console.log('[COMPANION] A abrir Google Chrome no Windows para Login...');

        try {
            // Usar diretoria temporária limpa para EVITAR bloqueios de SingletonLock com o Docker
            const tmpUserDataDir = path.join(os.tmpdir(), `neural_chrome_login_${Date.now()}`);

            activeContext = await chromium.launchPersistentContext(tmpUserDataDir, {
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

            const page = activeContext.pages().length > 0 ? activeContext.pages()[0] : await activeContext.newPage();
            
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });

            console.log('[COMPANION] A navegar para https://www.linkedin.com/login');
            await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
            console.log('[COMPANION] Janela visível aberta! A aguardar login do utilizador...');

            // Polling para extrair li_at automaticamente assim que o utilizador fizer login
            let capturedToken = null;
            const startTime = Date.now();
            const maxWaitTime = 1000 * 60 * 5; // 5 minutos de limite

            const pollInterval = setInterval(async () => {
                try {
                    if (!activeContext) {
                        clearInterval(pollInterval);
                        return;
                    }

                    const cookies = await activeContext.cookies('https://www.linkedin.com');
                    const liAt = cookies.find(c => c.name === 'li_at');

                    if (liAt && liAt.value && liAt.value.length > 20) {
                        capturedToken = liAt.value;
                        console.log('[COMPANION] 🎯 Cookie li_at capturado com sucesso!');
                        clearInterval(pollInterval);

                        // Sincronizar com o backend Docker
                        try {
                            const postData = JSON.stringify({ token: capturedToken });
                            const syncReq = http.request(`${BACKEND_URL}/api/auth/linkedin/token`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Content-Length': Buffer.byteLength(postData)
                                }
                            }, (syncRes) => {
                                console.log('[COMPANION] ✅ Sessão sincronizada com backend Docker! Status:', syncRes.statusCode);
                            });
                            syncReq.on('error', (e) => console.error('[COMPANION] Erro sincronizacao:', e.message));
                            syncReq.write(postData);
                            syncReq.end();
                        } catch (syncErr) {
                            console.error('[COMPANION] Erro ao sincronizar com backend:', syncErr.message);
                        }

                        // Fechar o navegador após 2.5 segundos
                        setTimeout(async () => {
                            try {
                                if (activeContext) {
                                    await activeContext.close();
                                    activeContext = null;
                                }
                            } catch (_) {}
                            isLoggingIn = false;
                        }, 2500);

                        if (!res.writableEnded) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ 
                                success: true, 
                                message: 'Login detetado com sucesso! Sessão associada ao sistema.' 
                            }));
                        }
                    } else if (Date.now() - startTime > maxWaitTime) {
                        clearInterval(pollInterval);
                        if (activeContext) {
                            await activeContext.close();
                            activeContext = null;
                        }
                        isLoggingIn = false;
                        if (!res.writableEnded) {
                            res.writeHead(408, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, message: 'Tempo limite de login excedido.' }));
                        }
                    }
                } catch (err) {
                    // Ignora erros temporários durante navegação
                }
            }, 1000);

            // Se o utilizador fechar a janela manualmente
            page.on('close', async () => {
                clearInterval(pollInterval);
                if (!capturedToken) {
                    console.log('[COMPANION] Janela fechada pelo utilizador antes da captura.');
                    isLoggingIn = false;
                    activeContext = null;
                    if (!res.writableEnded) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: 'Janela de login fechada.' }));
                    }
                }
            });

        } catch (err) {
            isLoggingIn = false;
            activeContext = null;
            console.error('[COMPANION ERROR]:', err.message);
            if (!res.writableEnded) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: `Erro ao abrir navegador: ${err.message}` }));
            }
        }
        return;
    }

    res.writeHead(404);
    res.end();
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`====================================================`);
    console.log(`🚀 NEURAL DESKTOP COMPANION ATIVO EM http://127.0.0.1:${PORT}`);
    console.log(`✨ Permite login com 1 clique diretamente na App Web`);
    console.log(`====================================================`);
});
