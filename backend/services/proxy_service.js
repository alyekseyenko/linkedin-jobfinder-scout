const fs = require('fs');
const path = require('path');
const logger = require('./logger_service');

const configDir = path.join(__dirname, '..', 'config');
const configFile = path.join(configDir, 'proxies.json');

class ProxyService {
    constructor() {
        this.proxies = [];
        this.currentIndex = 0;
        this.defaultCooldownMs = 5 * 60 * 1000; // 5 minutes quarantine on block
        this.loadProxies();
    }

    loadProxies() {
        const pool = [];

        // 1. From Environment Variable PROXY_POOL ("http://ip1:port,http://user:pass@ip2:port")
        if (process.env.PROXY_POOL) {
            const envList = process.env.PROXY_POOL.split(',').map(p => p.trim()).filter(Boolean);
            pool.push(...envList);
        }

        // 2. From config/proxies.json file
        if (fs.existsSync(configFile)) {
            try {
                const fileData = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                if (Array.isArray(fileData)) {
                    pool.push(...fileData.map(p => typeof p === 'string' ? p.trim() : p.url).filter(Boolean));
                }
            } catch (err) {
                logger.warn('proxy', 'Failed to read proxies.json:', err.message);
            }
        }

        const unique = [...new Set(pool)];
        this.proxies = unique.map(url => ({
            url,
            successCount: 0,
            failureCount: 0,
            quarantinedUntil: null,
            lastUsed: null,
            lastError: null
        }));

        logger.info('proxy', `Proxy Pool initialized with ${this.proxies.length} proxies (Fallback: Direct Connection).`);
    }

    // Mask passwords for logging / API responses: "http://user:pass@host:port" -> "http://user:***@host:port"
    maskProxy(proxyUrl) {
        if (!proxyUrl) return 'direct';
        try {
            const url = new URL(proxyUrl);
            if (url.password) {
                url.password = '***';
            }
            return url.toString();
        } catch (e) {
            return proxyUrl.replace(/:([^:@]+)@/, ':***@');
        }
    }

    addProxy(proxyUrl) {
        if (!proxyUrl || typeof proxyUrl !== 'string') return false;
        const trimmed = proxyUrl.trim();
        if (this.proxies.some(p => p.url === trimmed)) return false;

        this.proxies.push({
            url: trimmed,
            successCount: 0,
            failureCount: 0,
            quarantinedUntil: null,
            lastUsed: null,
            lastError: null
        });
        logger.info('proxy', `New proxy added to pool: ${this.maskProxy(trimmed)}`);
        return true;
    }

    getNextProxy() {
        if (this.proxies.length === 0) {
            return { url: null, directFallback: true, masked: 'direct' };
        }

        const now = Date.now();
        // Filter healthy (not currently in quarantine)
        const healthyProxies = this.proxies.filter(p => !p.quarantinedUntil || p.quarantinedUntil <= now);

        if (healthyProxies.length === 0) {
            logger.warn('proxy', 'All proxies are currently quarantined! Gracefully falling back to direct host connection.');
            return { url: null, directFallback: true, masked: 'direct (quarantine-fallback)' };
        }

        // Round-robin selection among healthy
        this.currentIndex = this.currentIndex % healthyProxies.length;
        const selected = healthyProxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % healthyProxies.length;

        selected.lastUsed = new Date().toISOString();
        return {
            url: selected.url,
            directFallback: false,
            masked: this.maskProxy(selected.url)
        };
    }

    reportSuccess(proxyUrl) {
        if (!proxyUrl) return;
        const item = this.proxies.find(p => p.url === proxyUrl);
        if (item) {
            item.successCount++;
            item.quarantinedUntil = null;
            item.lastError = null;
        }
    }

    reportFailure(proxyUrl, reason = 'Connection error / Anti-Bot block', cooldownMs = this.defaultCooldownMs) {
        if (!proxyUrl) return;
        const item = this.proxies.find(p => p.url === proxyUrl);
        if (item) {
            item.failureCount++;
            item.quarantinedUntil = Date.now() + cooldownMs;
            item.lastError = reason;
            const cooldownSec = Math.round(cooldownMs / 1000);
            logger.warn('proxy', `Proxy ${this.maskProxy(proxyUrl)} placed in quarantine for ${cooldownSec}s. Reason: ${reason}`);
        }
    }

    getPoolStatus() {
        const now = Date.now();
        const active = this.proxies.filter(p => !p.quarantinedUntil || p.quarantinedUntil <= now);
        const quarantined = this.proxies.filter(p => p.quarantinedUntil && p.quarantinedUntil > now);

        return {
            total: this.proxies.length,
            activeCount: active.length,
            quarantinedCount: quarantined.length,
            directFallbackActive: active.length === 0,
            proxies: this.proxies.map(p => ({
                url: this.maskProxy(p.url),
                status: (p.quarantinedUntil && p.quarantinedUntil > now) ? 'quarantined' : 'healthy',
                quarantinedRemainingSeconds: (p.quarantinedUntil && p.quarantinedUntil > now) ? Math.max(0, Math.round((p.quarantinedUntil - now) / 1000)) : 0,
                successCount: p.successCount,
                failureCount: p.failureCount,
                lastUsed: p.lastUsed,
                lastError: p.lastError
            }))
        };
    }
}

const proxyService = new ProxyService();
module.exports = proxyService;
