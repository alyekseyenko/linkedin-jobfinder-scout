import { describe, it, expect } from 'vitest';
import { generateCorrelationId } from '../lib/telemetry';

describe('Frontend Telemetry & Utilities', () => {
  it('generates valid RFC4122 v4 correlation UUIDs', () => {
    const cid1 = generateCorrelationId();
    const cid2 = generateCorrelationId();

    expect(cid1).toBeDefined();
    expect(typeof cid1).toBe('string');
    expect(cid1.length).toBeGreaterThan(15);
    expect(cid1).not.toBe(cid2);
  });
});
