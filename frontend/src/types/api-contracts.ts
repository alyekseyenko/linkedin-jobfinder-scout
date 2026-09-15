// ============================================================
// 🛡️ API CONTRACT DEFINITIONS (Cross-Stack Type Safety)
// Synchronized with backend/contracts/schemas.js & OpenAPI 3.0
// ============================================================

export interface JobImportPayload {
  url?: string;
  title?: string;
  company?: string;
  description?: string;
  location?: string;
}

export interface AutopilotConfigPayload {
  dailyLimit?: number;    // 1 to 10
  intervalHours?: number; // 1 to 24
  maxPages?: number;      // 1 to 10
}

export interface CookieConfigPayload {
  cookie?: string;
  li_at?: string;
}

export interface PortfolioAnalyzePayload {
  text: string;
}

export interface BioGeneratePayload {
  tone?: 'visionary' | 'technical' | 'executive';
}

export interface VisionActPayload {
  instruction: string;
}

export interface ApiShieldErrorIssue {
  field: string;
  message: string;
}

export interface ApiShieldErrorResponse {
  success: false;
  error: string;
  issues: ApiShieldErrorIssue[];
  correlationId?: string;
}

export interface JobQueueStatus {
  pending: number;
  active: number;
  completed: number;
  failed: number;
  quarantined: number;
}

export interface ProxyItem {
  id: string;
  url: string;
  healthy: boolean;
  failures: number;
  quarantinedUntil: number | null;
  lastUsed: number | null;
}

export interface ProxyPoolStatus {
  total: number;
  healthy: number;
  quarantined: number;
  currentIndex: number;
  proxies: ProxyItem[];
}

export interface SystemSanityResponse {
  timestamp: string;
  overallStatus: 'healthy' | 'degraded' | 'offline';
  components: {
    database: {
      status: string;
      latencyMs?: number;
      provider?: string;
      error?: string;
    };
    aiService: {
      status: string;
      providers: {
        groq: boolean;
        gemini: boolean;
        cohere: boolean;
      };
    };
    mcpScraper: {
      status: string;
      ready?: boolean;
      activeProcess?: boolean;
    };
    cacheService: {
      status: string;
    };
    visionService: {
      status: string;
      engine: string;
    };
    proxyPool: ProxyPoolStatus;
    jobQueue?: JobQueueStatus;
    aiEngineBridge: {
      status: string;
      target: string;
      latencyMs: number | null;
    };
  };
  diagnosticDurationMs: number;
}
