const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const vaultService = require('./vault_service');

const backendDir = path.join(__dirname, '..');
const isDocker = fs.existsSync('/.dockerenv');
const isWindows = process.platform === 'win32';

let MCP_COMMAND;
if (isDocker) {
    MCP_COMMAND = 'linkedin-scraper-mcp';
} else {
    const venvPath = isWindows
        ? path.join(backendDir, 'mcp_engine', 'venv', 'Scripts', 'linkedin-scraper-mcp.exe')
        : path.join(backendDir, 'mcp_engine', 'venv', 'bin', 'linkedin-scraper-mcp');
    const userScriptsPath = isWindows
        ? path.join(process.env.APPDATA || '', 'Python', 'Python314', 'Scripts', 'linkedin-scraper-mcp.exe')
        : '';
    const roamingScriptsPath = isWindows
        ? path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python314', 'Scripts', 'linkedin-scraper-mcp.exe')
        : '';

    if (userScriptsPath && fs.existsSync(userScriptsPath)) {
        MCP_COMMAND = userScriptsPath;
    } else if (roamingScriptsPath && fs.existsSync(roamingScriptsPath)) {
        MCP_COMMAND = roamingScriptsPath;
    } else if (fs.existsSync(venvPath)) {
        MCP_COMMAND = venvPath;
    } else {
        MCP_COMMAND = 'linkedin-scraper-mcp';
    }
}
console.log(`[MCP SERVICE] Using MCP Scraper binary: ${MCP_COMMAND}`);

const MCP_ARGS = ['--log-level', 'DEBUG', '--user-data-dir', path.join(backendDir, 'linkedin_profile'), '--claim-profile-root'];

const proxyService = require('./proxy_service');
let currentProxy = null;
let mcpProcess = null;
let mcpReady = false;
let pendingCalls = new Map();
let queue = [];
let isProcessingQueue = false;

// 🛡️ RESILIENCE: Human-like Jitter Delay
async function humanJitter(min = 2000, max = 5000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log(`[RESILIENCE] Simulating human focus pause: ${delay}ms...`);
    return new Promise(r => setTimeout(r, delay));
}

function ensureLinkedInSession() {
    try {
        const cookieVal = process.env.LI_AT || process.env.LINKEDIN_COOKIE || process.env.LINKEDIN_SESSION_COOKIE || vaultService.getSecret('li_at') || vaultService.getSecret('linkedin_cookie');
        if (!cookieVal) return;

        const profileDir = path.join(backendDir, 'linkedin_profile');
        const defaultDir = path.join(profileDir, 'Default');
        if (!fs.existsSync(defaultDir)) {
            fs.mkdirSync(defaultDir, { recursive: true });
        }
        const prefFile = path.join(defaultDir, 'Preferences');
        if (!fs.existsSync(prefFile)) {
            fs.writeFileSync(prefFile, '{}', 'utf8');
        }

        const cookiesPath = path.join(backendDir, 'cookies.json');
        const cookies = [
            {
                name: 'li_at',
                value: cookieVal,
                domain: '.linkedin.com',
                path: '/',
                expires: 1893456000,
                httpOnly: true,
                secure: true,
                sameSite: 'None'
            }
        ];
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2), 'utf8');

        const sourceStatePath = path.join(backendDir, 'source-state.json');
        const sourceState = {
            version: 1,
            source_runtime_id: 'windows-amd64-host',
            login_generation: '15f6a287-5650-4f53-a50b-3cd6308cd3aa',
            created_at: new Date().toISOString(),
            profile_path: profileDir,
            cookies_path: cookiesPath
        };
        fs.writeFileSync(sourceStatePath, JSON.stringify(sourceState, null, 2), 'utf8');

        const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH || '/root/.cache/ms-playwright';
        const browserMetadataPath = path.join(backendDir, 'browser-install.json');
        if (fs.existsSync(browsersPath) && !fs.existsSync(browserMetadataPath)) {
            const meta = {
                version: 3,
                runtime_id: 'linux-amd64-container',
                installed_at: new Date().toISOString(),
                browsers_path: browsersPath,
                browser_name: 'chromium',
                installer_name: 'patchright',
                patchright_version: '1.49.0',
                installed_targets: {
                    'chromium-1228': true,
                    'chromium_headless_shell-1228': true
                }
            };
            fs.writeFileSync(browserMetadataPath, JSON.stringify(meta, null, 2), 'utf8');
        }
        console.log('[MCP SERVICE] ✅ Auto-synced LinkedIn session and cookies from environment.');
    } catch (e) {
        console.warn('[MCP SERVICE] Warning during ensureLinkedInSession:', e.message);
    }
}

// Start LinkedIn MCP Server subprocess
function startLinkedInMCP() {
    if (mcpProcess) {
        console.log('[MCP SERVICE] Process already running PID:', mcpProcess.pid);
        return mcpProcess;
    }

    ensureLinkedInSession();

    console.log('\n[MCP SERVICE] Launching LinkedIn Engine (STDIO)...');

    currentProxy = proxyService.getNextProxy();
    const spawnArgs = [...MCP_ARGS];
    if (currentProxy && currentProxy.url) {
        spawnArgs.push('--proxy-server', currentProxy.url);
        console.log(`[MCP SERVICE] Routing scraper through Proxy: ${currentProxy.masked}`);
    } else {
        console.log('[MCP SERVICE] Routing scraper through Direct Host Connection');
    }

    const proxyEnv = (currentProxy && currentProxy.url) ? {
        HTTP_PROXY: currentProxy.url,
        HTTPS_PROXY: currentProxy.url,
        ALL_PROXY: currentProxy.url
    } : {};

    mcpProcess = spawn(MCP_COMMAND, spawnArgs, {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        env: {
            ...process.env,
            ...proxyEnv,
            PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || '/root/.cache/ms-playwright',
            LINKEDIN_COOKIE: process.env.LINKEDIN_COOKIE || vaultService.getSecret('linkedin_cookie'),
            LINKEDIN_SESSION_COOKIE: process.env.LINKEDIN_SESSION_COOKIE || vaultService.getSecret('linkedin_session_cookie'),
            LI_AT: process.env.LI_AT || vaultService.getSecret('li_at'),
            UV_HTTP_TIMEOUT: '300',
            PYTHONUNBUFFERED: '1'
        }
    });

    let buffer = '';

    // Send initialize immediately after spawn
    setTimeout(() => {
        if (!pendingCalls.has('init-1') && !mcpReady) {
            sendInitialize();
        }
    }, 1500);

    mcpProcess.stdout.on('data', (data) => {
        const output = data.toString();
        buffer += output;

        if (output.includes('Starting MCP server')) {
            if (!pendingCalls.has('init-1') && !mcpReady) {
                sendInitialize();
            }
        }

        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop(); // Keep last incomplete line

        const processJson = (line) => {
            if (!line.trim()) return false;
            try {
                const parsed = JSON.parse(line);
                if (parsed.id && pendingCalls.has(parsed.id)) {
                    const { resolve, reject, timeout } = pendingCalls.get(parsed.id);
                    clearTimeout(timeout);
                    pendingCalls.delete(parsed.id);

                    if (parsed.error) {
                        const msg = parsed.error.message || '';
                        if (msg.includes('Network error') || msg.includes('401') || msg.includes('auth')) {
                            reject(new Error('LINKEDIN_SESSION_EXPIRED'));
                        } else {
                            reject(new Error(msg || 'Engine internal error'));
                        }
                    } else {
                        if (!mcpReady) {
                            mcpReady = true;
                            console.log('\n[SUCCESS] LINKEDIN MCP INITIALIZED IN SERVICE\n');
                            if (parsed.id === 'init-1') {
                                sendInitializedNotification();
                            }
                        }
                        resolve(parsed.result || parsed);
                    }
                }
                return true;
            } catch (e) {
                return false;
            }
        };

        for (const line of lines) {
            processJson(line);
        }

        if (buffer.trim() && processJson(buffer)) {
            buffer = '';
        }
    });

    mcpProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('[MCP ENGINE LOG]', output.trim());
        if (output.includes('Starting MCP server') || output.includes('LinkedIn MCP Server') || output.includes('transport \'stdio\'') || output.includes('FastMCP')) {
            if (!pendingCalls.has('init-1') && !mcpReady) {
                setTimeout(() => {
                    sendInitialize();
                }, 500);
            }
        }
    });

    mcpProcess.on('close', (code) => {
        console.log(`[MCP SERVICE] Engine process exited with code ${code}`);
        mcpReady = false;
        mcpProcess = null;
    });

    mcpProcess.on('error', (err) => {
        console.error('[MCP SERVICE] Failed to start engine:', err.message);
        mcpReady = false;
        mcpProcess = null;
    });

    return mcpProcess;
}

function sendInitialize() {
    if (!mcpProcess || !mcpProcess.stdin) return;
    const payload = {
        jsonrpc: '2.0',
        id: 'init-1',
        method: 'initialize',
        params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'SkillHunter-Bridge-Decoupled', version: '1.0.0' }
        }
    };
    console.log('[MCP SERVICE] Sending "initialize" to Engine...');
    pendingCalls.set('init-1', {
        resolve: () => { },
        reject: (err) => console.error('[MCP SERVICE] Init failed:', err),
        timeout: setTimeout(() => {
            console.error('[MCP SERVICE] Handshake Timeout: Engine did not respond to "initialize"');
        }, 15000)
    });
    mcpProcess.stdin.write(JSON.stringify(payload) + '\n');
}

function sendInitializedNotification() {
    if (!mcpProcess || !mcpProcess.stdin) return;
    const payload = {
        jsonrpc: '2.0',
        method: 'notifications/initialized'
    };
    mcpProcess.stdin.write(JSON.stringify(payload) + '\n');
}

// Low-level STDIO Dispatcher
function dispatchMcpCall(toolName, args) {
    if (!mcpProcess) {
        startLinkedInMCP();
    }

    return new Promise((resolve, reject) => {
        let waitCount = 0;
        const checkReady = setInterval(() => {
            if (mcpReady && mcpProcess && mcpProcess.stdin) {
                clearInterval(checkReady);
                executeDispatch();
            } else if (waitCount >= 30) {
                clearInterval(checkReady);
                reject(new Error('LinkedIn Engine is not ready after wait window.'));
            }
            waitCount++;
        }, 500);

        function executeDispatch() {
            const id = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7);
            const payload = {
                jsonrpc: '2.0',
                id: id,
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: args
                }
            };

            console.log(`[MCP QUEUE DISPATCH] Calling ${toolName} (ID: ${id})`);

            const timeout = setTimeout(() => {
                pendingCalls.delete(id);
                reject(new Error(`Timeout: Tool ${toolName} did not respond within 300s`));
            }, 300000);

            pendingCalls.set(id, { resolve, reject, timeout });

            try {
                mcpProcess.stdin.write(JSON.stringify(payload) + '\n');
            } catch (err) {
                clearTimeout(timeout);
                pendingCalls.delete(id);
                reject(new Error(`Communication error: ${err.message}`));
            }
        }
    });
}

// Process Serial Task Queue
async function processQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (queue.length > 0) {
        const item = queue.shift();
        const { toolName, args, retriesLeft, resolve, reject } = item;

        const scrapingTools = ['search_jobs', 'get_job_details', 'get_person_profile', 'get_company_profile'];
        if (scrapingTools.includes(toolName)) {
            await humanJitter();
        }

        try {
            const result = await dispatchMcpCall(toolName, args);
            if (currentProxy && currentProxy.url) {
                proxyService.reportSuccess(currentProxy.url);
            }
            resolve(result);
        } catch (err) {
            const isBlockOrTimeout = /429|999|block|captcha|timeout|proxy/i.test(err.message);
            if (currentProxy && currentProxy.url && isBlockOrTimeout) {
                proxyService.reportFailure(currentProxy.url, err.message);
            }

            if (retriesLeft > 0 && err.message !== 'LINKEDIN_SESSION_EXPIRED') {
                console.warn(`[MCP QUEUE RETRY] Task ${toolName} failed (${err.message}). Retrying in 3s... (${retriesLeft} retries remaining)`);
                await new Promise(r => setTimeout(r, 3000));
                queue.unshift({ toolName, args, retriesLeft: retriesLeft - 1, resolve, reject });
            } else {
                reject(err);
            }
        }
    }

    isProcessingQueue = false;
}

// Serial Rate-Limited Queue Interface
function callEngine(toolName, args = {}, options = {}) {
    const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 1;

    return new Promise((resolve, reject) => {
        queue.push({
            toolName,
            args,
            retriesLeft: maxRetries,
            resolve,
            reject
        });
        processQueue();
    });
}

// Restart Process Helper
function restartLinkedInMCP() {
    if (mcpProcess) {
        console.log('[MCP SERVICE] Terminating process for restart:', mcpProcess.pid);
        try {
            mcpProcess.kill('SIGTERM');
        } catch (e) {}
        mcpProcess = null;
        mcpReady = false;
    }
    return startLinkedInMCP();
}

module.exports = {
    startLinkedInMCP,
    restartLinkedInMCP,
    callEngine,
    isReady: () => mcpReady,
    getPid: () => (mcpProcess ? mcpProcess.pid : 'none'),
    getHealthStatus: () => ({
        mcpReady,
        method: 'STDIO (Decoupled Queue Service)',
        enginePid: mcpProcess ? mcpProcess.pid : 'none',
        queueLength: queue.length,
        proxy: currentProxy ? currentProxy.masked : 'direct'
    })
};
