/**
 * LinkedIn MCP API Service
 * Handles communication with the backend proxy for LinkedIn tasks
 */

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  matchScore?: number;
  description: string;
  url: string;
  matchedSkills?: string[];
  missingSkills?: string[];
  aiReport?: string;
  isReal?: boolean;
  status?: string;
  linkedin_id?: string;
  budget?: string;
  salary?: string;
  updated_at?: string;
  isFresh?: boolean;
  deep_intelligence_pack?: any;
  // Supabase snake_case fields
  matched_skills?: string | string[];
  skills_gaps?: string | string[];
  ai_report?: string;
  forensics_report?: string;
  pitch_message?: string;
  strategy_analysis?: string;
  company_intel?: string;
  match_score?: number;
  work_area?: string;
  attack_strategy?: string;
  linkedin_connect_note?: string;
  inmail_pitch?: string;
  detected_language?: string;
  // camelCase aliases (search results / legacy)
  gaps?: string | string[];
  forensicsReport?: string;
  strategyAnalysis?: string;
  pitchMessage?: string;
  companyIntel?: string;
}


export interface Profile {
  name?: string;
  headline?: string;
  location?: string;
  skills?: string[];
  experience?: Array<{
    title: string;
    company: string;
    description: string;
  }>;
  [key: string]: any;
}

const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/+$/, '');

export const mcpService = {
  /**
   * Check if backend and MCP are ready
   */
  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE}/health`);
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'offline' };
    }
  },

  /**
   * Check if LinkedIn session is valid
   */
  async checkAuth() {
    try {
      const response = await fetch(`${API_BASE}/auth/status`);
      return await response.json();
    } catch (error) {
      console.error('Auth check failed:', error);
      return { authenticated: false };
    }
  },

  /**
   * Trigger interactive login
   */
  async triggerLogin() {
    const response = await fetch(`${API_BASE}/login`, { method: 'POST' });
    if (!response.ok) {
       const err = await response.json().catch(() => ({}));
       throw new Error(err.error || `Login failed (${response.status})`);
    }
    return await response.json();
  },

  /**
   * Fetch personal profile
   */
  async fetchProfile(): Promise<Profile> {
    const response = await fetch(`${API_BASE}/profile`);
    if (!response.ok) {
       const err = await response.json().catch(() => ({}));
       throw new Error(err.error || `Profile fetch failed (${response.status})`);
    }
    return await response.json();
  },

  /**
   * Search for jobs with advanced filters
   */
  async searchJobs(config: { 
    keywords: string; 
    location: string; 
    experience?: string[]; 
    jobType?: string[]; 
    remote?: boolean;
    workMode?: string;
    datePosted?: string;
    maxPages?: number;
    resultsLimit?: number;
    maxDays?: number;
  }, limit: number = 7): Promise<Job[]> {
    const finalLimit = config.resultsLimit || limit;
    const params = new URLSearchParams({
      keywords: config.keywords,
      location: config.location || 'Portugal',
      limit: finalLimit.toString(),
      results_limit: finalLimit.toString()
    });

    if (config.experience && config.experience.length > 0) {
      params.append('experience_level', config.experience[0].toLowerCase().replace('-', '_'));
    }

    if (config.jobType && config.jobType.length > 0) {
      params.append('job_type', config.jobType[0].toLowerCase().replace('-', '_'));
    }

    if (config.workMode) {
      params.append('work_mode', config.workMode);
    }

    if (config.remote) {
      params.append('remote', 'true');
    }
    
    if (config.datePosted) {
      params.append('date_posted', config.datePosted);
    }

    if (config.maxPages) {
      params.append('max_pages', config.maxPages.toString());
    }

    // Always send max_days (default 30 if not set, to be permissive)
    params.append('max_days', (config.maxDays || 30).toString());
    
    const response = await fetch(`${API_BASE}/jobs?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch jobs');
    return await response.json();
  },

  /**
   * Analyze portfolio text to extract skills
   */
  async analyzePortfolio(text: string) {
    const response = await fetch(`${API_BASE}/analyze-portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!response.ok) throw new Error('Failed to analyze portfolio');
    return await response.json();
  },

  /**
   * Learn more about the user from a website URL
   */
  async learnFromUrl(url: string) {
    const response = await fetch(`${API_BASE}/learn-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!response.ok) {
       const err = await response.json().catch(() => ({}));
       throw new Error(err.error || `Failed to crawl URL (${response.status})`);
    }
    return await response.json();
  },

  /**
   * Save Groq API Key to backend
   */
  async saveGroqKey(apiKey: string) {
    const response = await fetch(`${API_BASE}/config/groq`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey })
    });
    if (!response.ok) throw new Error('Failed to save Groq Key');
    return await response.json();
  },

  /**
   * Request a deep AI analysis for a specific job
   */
  async analyzeJobDeeply(jobId: string) {
    const response = await fetch(`${API_BASE}/jobs/${jobId}/analyze`, {
      method: 'POST'
    });
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.hint || 'AI Analysis failed');
    }
    return await response.json(); // returns { success: true, status: 'queued' }
  },

  /**
   * Check status of asynchronous deep analysis
   */
  async checkDeepAnalysisStatus(jobId: string) {
    const response = await fetch(`${API_BASE}/jobs/${jobId}/analyze/status`);
    if (!response.ok) throw new Error('Failed to check analysis status');
    return await response.json();
  },

  /**
   * Upload a CV file (PDF/Docx) to learn from
   */
  async uploadCV(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE}/upload-cv`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
       const err = await response.json().catch(() => ({}));
       throw new Error(err.error || `Upload failed (${response.status})`);
    }
    return await response.json();
  },

  /**
   * Update the candidate CV profile directly
   */
  async updateCV(profileData: any) {
    const response = await fetch(`${API_BASE}/cv/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Update failed (${response.status})`);
    }
    return await response.json();
  },

  /**
   * Get the current expert profile from the server
   */
  async getExpertProfile() {
    const response = await fetch(`${API_BASE}/expert-profile`);
    if (!response.ok) throw new Error('Failed to fetch expert profile');
    return await response.json();
  },

  /**
   * Check LinkedIn connectivity and cookie health
   */
  async checkLinkedInHealth() {
    const response = await fetch(`${API_BASE}/diagnostic/linkedin`);
    if (!response.ok) throw new Error('LinkedIn diagnostic failed');
    return await response.json();
  },

  /**
   * Generate a professional bio in English using AI
   */
  async generateBio() {
    const response = await fetch(`${API_BASE}/generate-bio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Failed to generate bio');
    return await response.json();
  },

  /**
   * Fetch all jobs from the CRM (Supabase)
   */
  async fetchCRMJobs(): Promise<Job[]> {
    const response = await fetch(`${API_BASE}/crm/jobs`);
    if (!response.ok) throw new Error('Failed to fetch CRM jobs');
    return await response.json();
  },

  /**
   * Update a job's status in the CRM
   */
  async updateJobStatus(linkedinId: string, status: string, jobData?: Partial<Job>): Promise<Job> {
    const response = await fetch(`${API_BASE}/crm/jobs/${linkedinId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status,
        title: jobData?.title,
        company: jobData?.company,
        url: jobData?.url,
        description: jobData?.description,
        match_score: jobData?.matchScore,
        skills_gaps: jobData?.missingSkills,
        matched_skills: jobData?.matchedSkills,
        budget: jobData?.budget
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Status update failed (${response.status})`)
    };
    return await response.json();
  },

  /**
   * Permanently delete a job from the CRM
   */
  async deleteJob(linkedinId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/crm/jobs/${linkedinId}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Deletion failed (${response.status})`)
    };
  },

  // ── NEURAL AUTOPILOT ──────────────────────────────────────

  /**
   * Get current autopilot status and stats
   */
  async getAutopilotStatus(): Promise<{
    enabled: boolean;
    dailyLimit: number;
    intervalHours: number;
    maxPages: number;
    todayCount: number;
    totalJobsFound: number;
    lastRunAt: string | null;
    nextRunAt: string | null;
    safeMaxLimit: number;
  }> {
    const response = await fetch(`${API_BASE}/autopilot/status`);
    if (!response.ok) throw new Error('Failed to fetch autopilot status');
    return await response.json();
  },

  /**
   * Toggle autopilot ON or OFF
   */
  async toggleAutopilot(): Promise<{ enabled: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/autopilot/toggle`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to toggle autopilot');
    return await response.json();
  },

  /**
   * Update autopilot configuration (daily limit 1-5, interval min 3h, maxPages 1-5)
   */
  async setAutopilotConfig(dailyLimit: number, intervalHours: number, maxPages: number): Promise<{ success: boolean; config: any }> {
    const response = await fetch(`${API_BASE}/autopilot/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dailyLimit, intervalHours, maxPages })
    });
    if (!response.ok) throw new Error('Failed to update autopilot config');
    return await response.json();
  },

  /**
   * Forcefully reset the LinkedIn MCP Engine
   */
  async resetEngine(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/engine/reset`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to reset engine');
    return await response.json();
  },

  /**
   * Adapt the user's base CV to a specific job vacancy
   */
  async adaptCV(jobId: string): Promise<{ success: boolean; tailored_cv: any }> {
    const response = await fetch(`${API_BASE}/jobs/${jobId}/adapt-cv`, { method: 'POST' });
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || 'Failed to adapt CV');
    }
    return await response.json();
  },

  /**
   * Fetch the synthesized Neural Master CV from the AI expert identity
   */
  async fetchNeuralCV(): Promise<{ success: boolean; profile: any }> {
    const response = await fetch(`${API_BASE}/cv/neural`);
    if (!response.ok) throw new Error('Failed to fetch neural CV');
    return await response.json();
  },

  /**
   * Trigger the deep identity mapping process (Gemini 2.0)
   */
  async deepMap() {
    const response = await fetch(`${API_BASE}/neural/deep-map`, { method: 'POST' });
    if (!response.ok) throw new Error('Deep Mapping failed');
    return await response.json();
  },

  /**
   * Fetch all learned memories from Mem0
   */
  async getMemories() {
    const response = await fetch(`${API_BASE}/neural/memories`);
    if (!response.ok) throw new Error('Failed to fetch memories');
    return await response.json();
  },

  /**
   * Query the Knowledge Graph (LightRAG)
   */
  async queryGraph(query: string, mode: string = 'hybrid') {
    const response = await fetch(`${API_BASE}/neural/graph/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, mode })
    });
    if (!response.ok) throw new Error('Graph query failed');
    return await response.json();
  },

  // --- NEURAL VISION (ETAPA 2) ---
  
  /**
   * Initialize the Vision Engine (Stagehand)
   */
  async initVision() {
    const response = await fetch(`${API_BASE}/vision/init`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to initialize Vision Engine');
    return await response.json();
  },

  /**
   * Execute a visual action by intent
   */
  async visionAct(instruction: string) {
    const response = await fetch(`${API_BASE}/vision/act`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction })
    });
    if (!response.ok) throw new Error('Vision action failed');
    return await response.json();
  },

  /**
   * Verify extracted data against visual evidence (Gemini Vision)
   */
  async visionVerify(expectedData: any) {
    const response = await fetch(`${API_BASE}/vision/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedData })
    });
    if (!response.ok) throw new Error('Vision verification failed');
    return await response.json();
  },

  /**
   * Check Qdrant Vector DB health
   */
  async checkQdrantHealth() {
    const response = await fetch(`${API_BASE}/diagnostic/qdrant`);
    if (!response.ok) return { success: false, message: 'Qdrant Unreachable' };
    return await response.json();
  },

  /**
   * Check Arize Phoenix Tracing health
   */
  async checkPhoenixHealth() {
    const response = await fetch(`${API_BASE}/diagnostic/phoenix`);
    if (!response.ok) return { success: false, message: 'Phoenix Tracing Offline' };
    return await response.json();
  },

  /**
   * Check Semantic Cache health
   */
  async checkCacheHealth() {
    const response = await fetch(`${API_BASE}/diagnostic/cache`);
    if (!response.ok) return { success: false, message: 'Cache Service Fault' };
    return await response.json();
  },

  /**
   * Fetch real-time token usage and search quota statistics
   */
  async getNeuralBudget() {
    const response = await fetch(`${API_BASE}/diagnostic/neural-budget`);
    if (!response.ok) return { success: false, message: 'Budget Service Unreachable' };
    return await response.json();
  },

  /**
   * Functional Probe: Test LinkedIn Search
   */
  async probeSearch() {
    const response = await fetch(`${API_BASE}/diagnostic/probe/search`);
    if (!response.ok) return { success: false, message: 'Search Probe Failed' };
    return await response.json();
  },

  /**
   * Functional Probe: Test AI Graph Learning/Retrieval
   */
  async probeGraph() {
    const response = await fetch(`${API_BASE}/diagnostic/probe/graph`);
    if (!response.ok) return { success: false, message: 'Graph Probe Failed' };
    return await response.json();
  },

  /**
   * Functional Probe: Test Database Write/Delete cycle
   */
  async probeDatabase() {
    const response = await fetch(`${API_BASE}/diagnostic/probe/database`);
    if (!response.ok) return { success: false, message: 'Database Probe Failed' };
    return await response.json();
  },

  /**
   * Trigger a Full Neural Vision Hunt (Etapa 2)
   */
  async visionHunt(keywords: string, location: string) {
    const response = await fetch(`${API_BASE}/vision/hunt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords, location })
    });
    if (!response.ok) throw new Error('Neural Vision Hunt failed');
    return await response.json();
  },

  /**
   * Subscribe to Real-Time Telemetry Stream (SSE - Staff Principal)
   */
  subscribeTelemetry(
    onMessage: (event: { type: string; data: any }) => void,
    onError?: (err: any) => void
  ): () => void {
    const eventSource = new EventSource(`${API_BASE}/telemetry/stream`);

    eventSource.addEventListener('connected', (e: MessageEvent) => {
      try { onMessage({ type: 'connected', data: JSON.parse(e.data) }); } catch (_) {}
    });

    eventSource.addEventListener('heartbeat', (e: MessageEvent) => {
      try { onMessage({ type: 'heartbeat', data: JSON.parse(e.data) }); } catch (_) {}
    });

    eventSource.addEventListener('mcp', (e: MessageEvent) => {
      try { onMessage({ type: 'mcp', data: JSON.parse(e.data) }); } catch (_) {}
    });

    eventSource.addEventListener('ai', (e: MessageEvent) => {
      try { onMessage({ type: 'ai', data: JSON.parse(e.data) }); } catch (_) {}
    });

    eventSource.addEventListener('system', (e: MessageEvent) => {
      try { onMessage({ type: 'system', data: JSON.parse(e.data) }); } catch (_) {}
    });

    eventSource.onerror = (err) => {
      if (onError) onError(err);
    };

    // Return unsubscribe cleanup function
    return () => {
      eventSource.close();
    };
  },

  /**
   * System Sanity Diagnostics (Typed Contract)
   */
  async getSanity(): Promise<import('../types/api-contracts').SystemSanityResponse> {
    const res = await fetch(`${API_BASE}/system/sanity`);
    if (!res.ok) throw new Error(`Sanity diagnostic failed (${res.status})`);
    return await res.json();
  },

  /**
   * Background Queue Status (Typed Contract)
   */
  async getQueueStatus(): Promise<{ success: boolean; queue: import('../types/api-contracts').JobQueueStatus }> {
    const res = await fetch(`${API_BASE}/queue/status`);
    if (!res.ok) throw new Error(`Queue status failed (${res.status})`);
    return await res.json();
  },

  /**
   * Import Custom Job with Zod Validation
   */
  async importJob(payload: import('../types/api-contracts').JobImportPayload) {
    const res = await fetch(`${API_BASE}/jobs/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Job import failed (${res.status})`);
    }
    return await res.json();
  },

  /**
   * Update Autopilot Configuration with Validation
   */
  async updateAutopilotConfig(payload: import('../types/api-contracts').AutopilotConfigPayload) {
    const res = await fetch(`${API_BASE}/autopilot/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Autopilot config update failed (${res.status})`);
    }
    return await res.json();
  },

  /**
   * Get Real-time Market Intelligence & Role Recommendations based on user CV
   */
  async getMarketRecommendations(refresh: boolean = false): Promise<{
    success: boolean;
    generated_date: string;
    candidate_name: string;
    candidate_title: string;
    target_location: string;
    market_summary: string;
    market_signals: string[];
    recommended_roles: Array<{
      id: string;
      title: string;
      search_query: string;
      match_score: number;
      demand_level: string;
      demand_tier: 'critical' | 'high' | 'moderate';
      reasoning: string;
      top_skills: string[];
      estimated_salary: string;
      work_mode?: string;
    }>;
  }> {
    const url = `${API_BASE}/market/recommendations${refresh ? '?refresh=true' : ''}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch market recommendations (${res.status})`);
    }
    return await res.json();
  },

  /**
   * Force refresh live AI market scan
   */
  async refreshMarketRecommendations() {
    const res = await fetch(`${API_BASE}/market/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      throw new Error(`Failed to refresh market recommendations (${res.status})`);
    }
    return await res.json();
  },

  /**
   * Start Live Auto-Fill with Human-in-the-Loop
   */
  async startLiveAutofill(jobId: string, jobUrl?: string) {
    const res = await fetch(`${API_BASE}/vision/autofill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, jobUrl })
    });
    if (!res.ok) {
      throw new Error(`Failed to start live autofill (${res.status})`);
    }
    return await res.json();
  },

  /**
   * Poll Live Auto-Fill Status & Screenshot
   */
  async getAutofillStatus(jobId: string) {
    const res = await fetch(`${API_BASE}/vision/autofill/status/${jobId}`);
    if (!res.ok) {
      throw new Error(`Failed to get autofill status (${res.status})`);
    }
    return await res.json();
  },

  /**
   * Send remote click coordinates to live autofill session
   */
  async sendAutofillClick(jobId: string, xPercent: number, yPercent: number) {
    const res = await fetch(`${API_BASE}/jobs/${jobId}/autofill/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xPercent, yPercent })
    });
    if (!res.ok) throw new Error(`Click interaction failed (${res.status})`);
    return await res.json();
  },

  /**
   * Send remote typing input to live autofill session
   */
  async sendAutofillType(jobId: string, text: string) {
    const res = await fetch(`${API_BASE}/jobs/${jobId}/autofill/type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error(`Type interaction failed (${res.status})`);
    return await res.json();
  },


  /**
   * Get LinkedIn Authentication Lifecycle Status
   */
  async getLinkedInAuthStatus(): Promise<{
    authenticated: boolean;
    connected: boolean;
    method: 'browser_profile' | 'token' | null;
    hasProfileSession: boolean;
    hasToken: boolean;
    engineReady: boolean;
    message: string;
  }> {
    const res = await fetch(`${API_BASE}/auth/status`);
    if (!res.ok) {
      throw new Error(`Failed to get auth status (${res.status})`);
    }
    return await res.json();
  },

  /**
   * Save fresh LinkedIn li_at token
   */
  async saveLinkedInToken(token: string) {
    const res = await fetch(`${API_BASE}/auth/linkedin/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Falha ao guardar token');
    }
    return await res.json();
  },

  /**
   * Logout from LinkedIn and revoke session
   */
  async logoutLinkedIn() {
    const res = await fetch(`${API_BASE}/auth/linkedin/logout`, {
      method: 'POST'
    });
    if (!res.ok) {
      throw new Error('Falha ao terminar sessão');
    }
    return await res.json();
  },

  /**
   * Check if Native Windows Desktop Companion is online
   */
  async getDesktopCompanionStatus(): Promise<boolean> {
    try {
      const res = await fetch('http://127.0.0.1:3009/health', { 
        method: 'GET',
        signal: AbortSignal.timeout(1500) 
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  },

  /**
   * Trigger 1-Click Interactive Chrome Login via Desktop Companion
   */
  async triggerDesktopLogin(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('http://127.0.0.1:3009/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Falha ao comunicar com o navegador de login.');
    }
    return await res.json();
  }
};
