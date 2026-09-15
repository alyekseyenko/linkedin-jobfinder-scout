import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mcpService } from '../lib/mcp-service';

describe('Frontend MCP Client Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchCRMJobs calls /api/crm/jobs and returns parsed jobs list', async () => {
    const mockJobs = [
      { id: 'job-1', title: 'Senior AI Engineer', company: 'Anthropic', match_score: 95 }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockJobs
    } as Response);

    const jobs = await mcpService.fetchCRMJobs();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/crm/jobs'));
    expect(jobs).toEqual(mockJobs);
    expect(jobs.length).toBe(1);
    expect(jobs[0].title).toBe('Senior AI Engineer');
  });

  it('getLinkedInAuthStatus parses auth lifecycle response', async () => {
    const mockAuth = {
      authenticated: true,
      connected: true,
      method: 'browser_profile',
      engineReady: true
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockAuth
    } as Response);

    const auth = await mcpService.getLinkedInAuthStatus();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/status'));
    expect(auth.authenticated).toBe(true);
    expect(auth.method).toBe('browser_profile');
  });

  it('checkDeepAnalysisStatus queries background job status', async () => {
    const mockStatus = {
      status: 'completed',
      result: { match_score: 92, summary: 'High match' }
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockStatus
    } as Response);

    const status = await mcpService.checkDeepAnalysisStatus('job-999');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/jobs/job-999/analyze/status'));
    expect(status.status).toBe('completed');
    expect(status.result.match_score).toBe(92);
  });

  it('throws descriptive error when fetchCRMJobs fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500
    } as Response);

    await expect(mcpService.fetchCRMJobs()).rejects.toThrow();
  });
});
