const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit recommended for GCM
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256-bit

const vaultDir = path.join(__dirname, '..', 'vault');
const vaultFilePath = path.join(vaultDir, 'session_vault.enc');
const masterKeyPath = path.join(vaultDir, '.master.key');

if (!fs.existsSync(vaultDir)) {
    try {
        fs.mkdirSync(vaultDir, { recursive: true });
    } catch (e) {
        console.error('[VAULT INIT ERROR]', e.message);
    }
}

// Retrieve or generate master secret
function getMasterSecret() {
    if (process.env.VAULT_SECRET && process.env.VAULT_SECRET.length >= 16) {
        return process.env.VAULT_SECRET;
    }
    if (fs.existsSync(masterKeyPath)) {
        try {
            return fs.readFileSync(masterKeyPath, 'utf8').trim();
        } catch (e) {}
    }
    // Generate fresh persistent master secret
    const generated = crypto.randomBytes(32).toString('hex');
    try {
        fs.writeFileSync(masterKeyPath, generated, { encoding: 'utf8', mode: 0o600 });
    } catch (e) {}
    return generated;
}

// Derive a cryptographic key using PBKDF2
function deriveKey(secret, salt) {
    return crypto.pbkdf2Sync(secret, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

// Encrypt string with AES-256-GCM
function encryptData(plaintext, secret) {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = deriveKey(secret, salt);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Packed binary payload: salt (32b) + iv (12b) + tag (16b) + ciphertext
    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

// Decrypt base64 payload with AES-256-GCM
function decryptData(packedBase64, secret) {
    const buffer = Buffer.from(packedBase64, 'base64');

    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const ciphertext = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const key = deriveKey(secret, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
}

class SessionVault {
    constructor() {
        this.cache = null;
        this.secret = getMasterSecret();
    }

    loadVault() {
        if (!fs.existsSync(vaultFilePath)) {
            this.cache = { version: '1.0', updatedAt: new Date().toISOString(), secrets: {} };
            return this.cache;
        }

        try {
            const raw = fs.readFileSync(vaultFilePath, 'utf8').trim();
            const decryptedJson = decryptData(raw, this.secret);
            this.cache = JSON.parse(decryptedJson);
            return this.cache;
        } catch (err) {
            console.error('[VAULT ERROR] Decryption failed or vault corrupted:', err.message);
            this.cache = { version: '1.0', updatedAt: new Date().toISOString(), secrets: {} };
            return this.cache;
        }
    }

    saveVault() {
        if (!this.cache) this.cache = { version: '1.0', updatedAt: new Date().toISOString(), secrets: {} };
        this.cache.updatedAt = new Date().toISOString();

        try {
            const jsonString = JSON.stringify(this.cache);
            const encrypted = encryptData(jsonString, this.secret);
            fs.writeFileSync(vaultFilePath, encrypted, 'utf8');
            return true;
        } catch (err) {
            console.error('[VAULT ERROR] Failed to encrypt and save vault:', err.message);
            return false;
        }
    }

    storeSecret(key, value) {
        if (!this.cache) this.loadVault();
        this.cache.secrets[key] = value;
        return this.saveVault();
    }

    getSecret(key) {
        if (!this.cache) this.loadVault();
        return this.cache.secrets[key] || null;
    }

    getAllSecrets() {
        if (!this.cache) this.loadVault();
        return { ...this.cache.secrets };
    }

    // Transparently import legacy cookies into the encrypted vault
    migratePlainCookies(cookiesPath, envPath) {
        let imported = 0;
        if (!this.cache) this.loadVault();

        // 1. Try cookies.json
        if (cookiesPath && fs.existsSync(cookiesPath)) {
            try {
                const parsed = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
                if (Array.isArray(parsed)) {
                    const liAt = parsed.find(c => c.name === 'li_at');
                    if (liAt && liAt.value) {
                        this.cache.secrets['li_at'] = liAt.value;
                        this.cache.secrets['linkedin_cookie'] = `li_at=${liAt.value}`;
                        imported++;
                    }
                }
            } catch (e) {}
        }

        // 2. Try .env
        if (envPath && fs.existsSync(envPath) && !this.cache.secrets['li_at']) {
            try {
                const envContent = fs.readFileSync(envPath, 'utf8');
                const match = envContent.match(/LI_AT=["']?([^"'\r\n]+)/);
                if (match) {
                    this.cache.secrets['li_at'] = match[1];
                    this.cache.secrets['linkedin_cookie'] = `li_at=${match[1]}`;
                    imported++;
                }
            } catch (e) {}
        }

        if (imported > 0) {
            this.saveVault();
            console.log(`[VAULT MIGRATION] Migrated ${imported} credentials to Zero-Trust Encrypted Vault.`);
        }
        return imported;
    }
}

const vaultService = new SessionVault();
module.exports = vaultService;
