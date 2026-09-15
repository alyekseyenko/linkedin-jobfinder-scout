const { describe, it } = require('node:test');
const assert = require('node:assert');
const vaultService = require('../../services/vault_service');

describe('SessionVault AES-256-GCM', () => {
    it('stores and retrieves a secret correctly', () => {
        vaultService.storeSecret('test_unit_token', 'token_payload_xyz_123');
        const retrieved = vaultService.getSecret('test_unit_token');
        assert.strictEqual(retrieved, 'token_payload_xyz_123');
    });

    it('returns null for non-existent secret', () => {
        const retrieved = vaultService.getSecret('non_existent_key_9999');
        assert.strictEqual(retrieved, null);
    });

    it('getAllSecrets returns object mapping without runtime error', () => {
        const secrets = vaultService.getAllSecrets();
        assert.strictEqual(typeof secrets, 'object');
        assert.ok(secrets !== null);
    });
});
