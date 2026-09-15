// ============================================================
// 📊 TELEMETRY & CORRELATION CLIENT
// Propagates distributed tracing headers to microservice backend
// ============================================================

export function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'cid-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
}

export function createTraceHeaders(existingCid?: string): Record<string, string> {
  const cid = existingCid || generateCorrelationId();
  return {
    'X-Correlation-ID': cid,
    'Content-Type': 'application/json'
  };
}
