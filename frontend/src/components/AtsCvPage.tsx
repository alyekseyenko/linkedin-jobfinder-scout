import React, { useMemo, useState } from 'react';
import { Database, FileText, Download, Loader2, Sparkles, Target, TrendingUp } from 'lucide-react';
import { mcpService } from '../lib/mcp-service';
import { downloadAtsCvPdf } from '../lib/ats-pdf-export';
import { collectProfileLinks, parseTextSegments } from '../lib/ats-linkify';

type CoreCompetencies = {
  leadership_and_delivery?: string[];
  technical?: string[];
  platforms_and_tools?: string[];
};

type TailoredCv = {
  personal_info: {
    name?: string;
    title?: string;
    email?: string;
    phone?: string;
    location?: string;
    website?: string;
  };
  target_headline?: string;
  summary?: string;
  core_competencies?: CoreCompetencies | null;
  experience?: Array<{
    company: string;
    role: string;
    period: string;
    role_timeline?: Array<{ role: string; period: string }>;
    bullets?: string[];
  }>;
  selected_projects?: Array<{ name: string; impact?: string }>;
  hard_skills?: string[];
  education?: Array<string | { degree?: string; institution?: string; details?: string }>;
  certifications?: string[];
  keywords_used?: string[];
  fit_notes?: string;
};

type FitBreakdown = {
  titleScore: number;
  skillsScore: number;
  domainScore: number;
};

type AgentTraceLine = {
  agent: string;
  tool: string;
  one_line: string;
};

type ContextInsights = {
  vector_memory_count: number;
  memory_hits: Array<{ source: string; similarity_percent: number; snippet: string }>;
  ranked_projects: Array<{
    title: string;
    company?: string;
    portfolio_priority?: string;
    relevance_score: number;
    tech: string[];
  }>;
  experience_focus: Array<{ company: string; role: string; period: string }>;
  metric_highlights: string[];
  data_sources: string[];
};

type FitAssessment = {
  admission_chance_percent: number;
  match_score: number;
  keyword_overlap_only?: boolean;
  overlap_label_en?: string;
  level: string;
  label_en: string;
  matched_skills: string[];
  skills_gaps: string[];
  breakdown?: FitBreakdown;
  chance_rationale?: string;
  disclaimer_en?: string;
};

const CIRC = 100.53;

function cleanAtsCopy(text: string) {
  if (!text) return '';
  return text.replace(/\u2014|\u2013/g, ',').replace(/\s+/g, ' ').trim();
}

function AtsLinkify({ text }: { text: string }) {
  const segments = parseTextSegments(cleanAtsCopy(text));
  if (!segments.length) return null;
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'link' ? (
          <a
            key={i}
            href={seg.href}
            className="text-sky-700 hover:underline font-medium"
            target={seg.href.startsWith('mailto:') ? undefined : '_blank'}
            rel={seg.href.startsWith('mailto:') ? undefined : 'noreferrer'}
          >
            {seg.value}
          </a>
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </>
  );
}

function formatAtsPeriod(period: string) {
  if (!period) return '';
  return period
    .replace(/\u2014|\u2013/g, ' - ')
    .replace(/\s+to\s+/gi, ' - ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ChanceRing({
  percent,
  label,
  keywordOverlapOnly
}: {
  percent: number;
  label: string;
  keywordOverlapOnly?: boolean;
}) {
  const dashOffset = CIRC - (CIRC * percent) / 100;
  const color =
    percent >= 80 ? '#22c55e' : percent >= 65 ? '#38bdf8' : percent >= 45 ? '#fbbf24' : '#f87171';
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20 shrink-0">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="none" stroke="#e2e8f0" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-slate-900">
          {percent}%
        </span>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {keywordOverlapOnly ? 'Keyword overlap' : 'Screening fit'}
        </p>
        <p className="text-base font-bold text-slate-900">{label}</p>
        {keywordOverlapOnly ? (
          <p className="text-[10px] text-slate-500 mt-0.5">Heuristic overlap with the job description only</p>
        ) : (
          <p className="text-[10px] text-slate-500 mt-0.5">Screening estimate: {percent}%</p>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900 border-b border-slate-300 pb-1 mb-2.5">
      {children}
    </h3>
  );
}

function formatEdu(edu: string | { degree?: string; institution?: string; details?: string }) {
  if (typeof edu === 'string') return cleanAtsCopy(edu);
  const line = `${edu.degree || ''}${edu.institution ? `, ${edu.institution}` : ''}${edu.details ? ` (${edu.details})` : ''}`;
  return cleanAtsCopy(line);
}

const COMPETENCY_LABELS: Record<string, string> = {
  leadership_and_delivery: 'Leadership & delivery',
  technical: 'Technical',
  platforms_and_tools: 'Platforms & tools'
};

export default function AtsCvPage() {
  const [jobUrl, setJobUrl] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [tailored, setTailored] = useState<TailoredCv | null>(null);
  const [fitAssessment, setFitAssessment] = useState<FitAssessment | null>(null);
  const [target, setTarget] = useState<{ jobTitle: string; company: string } | null>(null);
  const [agentTrace, setAgentTrace] = useState<AgentTraceLine[]>([]);
  const [jobSource, setJobSource] = useState<string | null>(null);
  const [contextInsights, setContextInsights] = useState<ContextInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    const url = jobUrl.trim();
    const desc = jobDescription.trim();
    if (!url && desc.length < 10) {
      setError('Paste a job URL or a description with at least 10 characters.');
      return;
    }
    setError(null);
    setLoading(true);
    setTailored(null);
    setFitAssessment(null);
    setAgentTrace([]);
    setJobSource(null);
    setContextInsights(null);
    try {
      const normalizedUrl = url
        ? /^https?:\/\//i.test(url)
          ? url.trim()
          : `https://${url.trim().replace(/^\/+/, '')}`
        : '';
      const result = await mcpService.tailorCvFromDescription({
        jobUrl: normalizedUrl || undefined,
        jobDescription: desc || undefined,
        jobTitle: jobTitle.trim() || undefined,
        company: company.trim() || undefined
      });
      if (result.job_context) {
        setJobTitle(result.job_context.title || jobTitle);
        setCompany(result.job_context.company || company);
        setJobDescription(result.job_context.description || desc);
        if (result.job_context.jobUrl) setJobUrl(result.job_context.jobUrl);
      }
      setTailored(result.tailored_cv);
      setFitAssessment(result.fit_assessment ?? null);
      setTarget(result.target);
      setAgentTrace(result.agent_trace || []);
      setJobSource(result.job_resolution?.source || null);
      setContextInsights(result.context_insights ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate ATS CV.');
    } finally {
      setLoading(false);
    }
  };

  const exportSinglePagePdf = () => {
    if (!tailored) return;
    const cleanRole = (target?.jobTitle || jobTitle || 'Role').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 25);
    const cleanCo = (target?.company || company || 'Company').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
    downloadAtsCvPdf(tailored, `ATS_CV_${cleanRole}_${cleanCo}`, {
      targetRole: target?.jobTitle || jobTitle,
      targetCompany: target?.company || company
    });
  };

  const companyDisplay = target?.company || company;
  const competencies = tailored?.core_competencies;
  const hasCompetencyGroups =
    competencies &&
    Object.values(competencies).some((arr) => Array.isArray(arr) && arr.length > 0);

  const profileLinks = useMemo(() => (tailored ? collectProfileLinks(tailored) : []), [tailored]);

  return (
    <div className="min-h-screen bg-[#050505] text-white/90 px-4 sm:px-6 py-10 lg:py-14">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-black uppercase tracking-[0.2em] text-green-400">
            <Target size={12} /> One-page ATS
          </div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white">
            Tailored ATS resume
          </h1>
          <p className="text-white/50 max-w-2xl text-sm leading-relaxed">
            Paste a <span className="text-white/70">job URL</span> (LinkedIn or any public posting) or the description.
            Scout + Strategist agents analyze the role; your CV, pgvector memory, and trust layer produce a one-page resume in{' '}
            <span className="text-white/70">professional English</span>.
          </p>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,380px)_1fr] gap-8 items-start">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6 lg:sticky lg:top-6">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Job posting URL</label>
            <input
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-green-500/50 outline-none"
              placeholder="https://www.linkedin.com/jobs/view/… or any careers page"
            />
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Job title (optional)</label>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-green-500/50 outline-none"
              placeholder="e.g. Senior Full Stack Engineer"
            />
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Company (optional)</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-green-500/50 outline-none"
              placeholder="e.g. Acme Corp"
            />
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40">
              Job description {jobUrl.trim() ? '(optional if URL works)' : ''}
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={12}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-green-500/50 outline-none resize-y min-h-[180px] font-mono text-[12px] leading-relaxed"
              placeholder="Requirements, responsibilities, stack..."
            />
            {error && <p className="text-amber-400 text-xs">{error}</p>}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-full bg-green-500 text-black font-black uppercase text-xs tracking-widest hover:bg-green-400 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              {loading ? 'Fetching job & tailoring…' : 'Generate one-page CV'}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-[#fafafa] text-slate-900 shadow-xl min-h-[520px] overflow-hidden">
            {!tailored && !loading && (
              <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-slate-400 gap-3 p-8">
                <FileText size={40} className="opacity-30" />
                <p className="text-sm text-center max-w-sm">Your ATS resume preview will appear here after generation.</p>
              </div>
            )}
            {loading && (
              <div className="min-h-[420px] flex flex-col items-center justify-center text-slate-500 text-sm animate-pulse p-8 gap-2">
                <span>Resolving job, running Scout + Strategist, building CV…</span>
                <span className="text-[10px] text-slate-400">Usually 30–90 seconds</span>
              </div>
            )}
            {tailored && !loading && (
              <div className="flex flex-col">
                {fitAssessment && (
                  <section className="border-b border-slate-200 bg-white px-6 sm:px-10 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <ChanceRing
                        percent={fitAssessment.match_score}
                        label={fitAssessment.label_en || 'Keyword overlap'}
                        keywordOverlapOnly={fitAssessment.keyword_overlap_only}
                      />
                      {companyDisplay && (
                        <div className="text-right text-xs text-slate-500">
                          <TrendingUp size={14} className="inline text-sky-600 mb-1" />
                          <div className="font-semibold text-slate-800">{companyDisplay}</div>
                          {target?.jobTitle && <div className="text-slate-500">{target.jobTitle}</div>}
                        </div>
                      )}
                    </div>
                    {fitAssessment.chance_rationale && (
                      <p className="text-sm text-slate-600 leading-relaxed mt-4 max-w-3xl">
                        {cleanAtsCopy(fitAssessment.chance_rationale)}
                      </p>
                    )}
                    {fitAssessment.breakdown && (
                      <div className="flex flex-wrap gap-2 mt-3 text-[10px] text-slate-600">
                        <span className="rounded-md bg-slate-100 px-2 py-1">
                          Title alignment: {fitAssessment.breakdown.titleScore}/35
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-1">
                          Skills overlap: {fitAssessment.breakdown.skillsScore}/45
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-1">
                          Domain fit: {fitAssessment.breakdown.domainScore}/20
                        </span>
                      </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-4 mt-4 text-xs">
                      <div className="rounded-lg bg-emerald-50/80 border border-emerald-100 p-3">
                        <p className="font-bold text-emerald-800 uppercase tracking-wider mb-1.5">Strengths</p>
                        <p className="text-slate-700 leading-relaxed">
                          {(fitAssessment.matched_skills || []).slice(0, 8).join(', ') || '—'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-amber-50/80 border border-amber-100 p-3">
                        <p className="font-bold text-amber-900 uppercase tracking-wider mb-1.5">Gaps</p>
                        <p className="text-slate-700 leading-relaxed">
                          {(fitAssessment.skills_gaps || []).slice(0, 6).join(', ') || 'No critical gaps flagged'}
                        </p>
                      </div>
                    </div>
                    {jobSource && (
                      <p className="text-[10px] text-slate-500 mt-2">
                        Job data source: <span className="font-mono text-slate-600">{jobSource}</span>
                      </p>
                    )}
                    {contextInsights && (
                      <div className="mt-4 rounded-lg border border-sky-100 bg-gradient-to-br from-sky-50/90 to-white p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Database size={14} className="text-sky-700" />
                          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-900">
                            Profile context (CV + vector memory)
                          </p>
                        </div>
                        <ul className="text-[10px] text-slate-600 space-y-1 mb-3">
                          {contextInsights.data_sources.map((src, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-sky-600 shrink-0">•</span>
                              <span>{src}</span>
                            </li>
                          ))}
                        </ul>
                        {contextInsights.metric_highlights.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {contextInsights.metric_highlights.map((m, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-sky-100 text-slate-700"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                        {contextInsights.ranked_projects.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-semibold text-slate-700 mb-1.5">
                              Projects ranked for this job
                            </p>
                            <ul className="space-y-2">
                              {contextInsights.ranked_projects.slice(0, 4).map((p, i) => (
                                <li
                                  key={i}
                                  className="text-[11px] rounded-md bg-white/80 border border-slate-100 px-2.5 py-2"
                                >
                                  <div className="flex flex-wrap justify-between gap-1">
                                    <span className="font-semibold text-slate-800">{p.title}</span>
                                    <span className="text-[10px] text-sky-700 font-mono">
                                      relevance {p.relevance_score}
                                    </span>
                                  </div>
                                  {p.company && <p className="text-slate-500 text-[10px]">{p.company}</p>}
                                  {p.tech?.length > 0 && (
                                    <p className="text-slate-600 text-[10px] mt-1 leading-snug">
                                      {p.tech.join(' · ')}
                                    </p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {contextInsights.memory_hits.length > 0 ? (
                          <div>
                            <p className="text-[10px] font-semibold text-slate-700 mb-1.5">
                              Vector memory hits ({contextInsights.vector_memory_count})
                            </p>
                            <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
                              {contextInsights.memory_hits.slice(0, 5).map((hit, i) => (
                                <li
                                  key={i}
                                  className="text-[10px] text-slate-600 border-l-2 border-sky-200 pl-2 leading-snug"
                                >
                                  <span className="font-mono text-sky-800">{hit.similarity_percent}%</span>
                                  <span className="text-slate-400"> · {hit.source}</span>
                                  <p className="text-slate-700 mt-0.5">
                                    {hit.snippet}
                                    {hit.snippet.length >= 238 ? '…' : ''}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 leading-snug">
                            No strong vector matches yet. Tailoring uses your master CV and knowledge base. Add notes via
                            Teach / profile ingest to enrich pgvector memory.
                          </p>
                        )}
                      </div>
                    )}
                    {agentTrace.length > 0 && (
                      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">Agent trace</p>
                        <ul className="space-y-1.5 text-[11px] text-slate-700">
                          {agentTrace.map((line, i) => (
                            <li key={i}>
                              <span className="font-semibold text-slate-800">{line.agent}</span>
                              <span className="text-slate-400"> · {line.tool}</span>
                              <span className="block text-slate-600 leading-snug">{cleanAtsCopy(line.one_line)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 mt-3 leading-snug">
                      {fitAssessment.disclaimer_en ||
                        'Estimate based on your profile and the job description. Not a guarantee of interview or offer.'}
                    </p>
                  </section>
                )}

                <article
                  className="px-8 sm:px-12 py-9 sm:py-11 max-w-[780px] mx-auto w-full text-[13px] leading-[1.55] bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/80"
                  aria-label="ATS resume preview"
                >
                  <header className="border-b-[2px] border-slate-900 pb-3 mb-5">
                    <h2 className="text-[26px] font-bold text-slate-900 tracking-tight leading-tight">
                      {tailored.personal_info?.name}
                    </h2>
                    {(tailored.target_headline || tailored.personal_info?.title) && (
                      <p className="text-sky-800 font-medium text-[15px] mt-1.5">
                        {cleanAtsCopy(tailored.target_headline || tailored.personal_info?.title || '')}
                      </p>
                    )}
                    <div className="text-[11px] text-slate-500 mt-2.5 space-y-1">
                      {[tailored.personal_info?.location, tailored.personal_info?.phone].filter(Boolean).length >
                        0 && (
                        <p>
                          {[tailored.personal_info?.location, tailored.personal_info?.phone]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                      {profileLinks.length > 0 && (
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {profileLinks.map((link, i) => (
                            <span key={link.href} className="inline-flex items-center gap-2">
                              {i > 0 && <span className="text-slate-400" aria-hidden>·</span>}
                              <a
                                href={link.href}
                                className="text-sky-700 hover:underline font-medium"
                                target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                                rel={link.href.startsWith('mailto:') ? undefined : 'noreferrer'}
                              >
                                {link.label}
                              </a>
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </header>

                  {tailored.summary && (
                    <section className="mb-7">
                      <SectionTitle>Professional summary</SectionTitle>
                      <p className="text-slate-800 leading-[1.65]">
                        <AtsLinkify text={tailored.summary} />
                      </p>
                    </section>
                  )}

                  {hasCompetencyGroups && competencies && (
                    <section className="mb-7 space-y-4">
                      <SectionTitle>Core competencies</SectionTitle>
                      {Object.entries(competencies).map(([key, items]) => {
                        if (!Array.isArray(items) || items.length === 0) return null;
                        return (
                          <div key={key}>
                            <p className="text-xs font-semibold text-slate-600 mb-1.5">
                              {COMPETENCY_LABELS[key] || key.replace(/_/g, ' ')}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {items.map((skill, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-800"
                                >
                                  {cleanAtsCopy(skill)}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </section>
                  )}

                  {tailored.hard_skills && tailored.hard_skills.length > 0 && (
                    <section className="mb-7">
                      <SectionTitle>Technical skills</SectionTitle>
                      <div className="flex flex-wrap gap-1.5">
                        {tailored.hard_skills.map((skill, i) => (
                          <span
                            key={i}
                            className="text-xs px-2.5 py-1 rounded-full border border-slate-300 bg-white text-slate-800"
                          >
                            {cleanAtsCopy(skill)}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {tailored.experience && tailored.experience.length > 0 && (
                    <section className="mb-7">
                      <SectionTitle>Professional experience</SectionTitle>
                      <div className="space-y-6">
                        {tailored.experience.map((exp, i) => (
                          <div key={i}>
                            {exp.role_timeline && exp.role_timeline.length > 0 ? (
                              <>
                                <div className="flex flex-wrap justify-between gap-2 items-baseline">
                                  <p className="font-bold text-slate-900">{cleanAtsCopy(exp.company)}</p>
                                  <p className="text-xs text-slate-500 shrink-0">{formatAtsPeriod(exp.period)}</p>
                                </div>
                                <div className="space-y-1 mb-2 mt-1">
                                  {exp.role_timeline.map((rt, k) => (
                                    <p key={k} className="text-sm text-slate-700">
                                      <span className="text-xs text-slate-500">{formatAtsPeriod(rt.period)}</span>
                                      <span className="mx-2 text-slate-400">·</span>
                                      <span className="font-medium">{cleanAtsCopy(rt.role)}</span>
                                    </p>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex flex-wrap justify-between gap-2 items-baseline">
                                  <p className="font-bold text-slate-900">{cleanAtsCopy(exp.role)}</p>
                                  <p className="text-xs text-slate-500 shrink-0">{formatAtsPeriod(exp.period)}</p>
                                </div>
                                <p className="text-sm text-slate-600 font-medium mb-2">{cleanAtsCopy(exp.company)}</p>
                              </>
                            )}
                            <ul className="list-disc pl-5 text-slate-800 space-y-1.5 marker:text-slate-400">
                              {(exp.bullets || []).map((b, j) => (
                                <li key={j} className="leading-[1.55]">
                                  <AtsLinkify text={b} />
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {tailored.selected_projects && tailored.selected_projects.length > 0 && (
                    <section className="mb-7">
                      <SectionTitle>Selected projects</SectionTitle>
                      <ul className="space-y-2">
                        {tailored.selected_projects.map((p, i) => (
                          <li key={i} className="text-slate-800">
                            <span className="font-semibold text-slate-900">
                              <AtsLinkify text={p.name} />
                            </span>
                            {p.impact && (
                              <span className="text-slate-700">
                                : <AtsLinkify text={p.impact} />
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {((tailored.education && tailored.education.length > 0) ||
                    (tailored.certifications && tailored.certifications.length > 0)) && (
                    <section className="mb-7">
                      <SectionTitle>Education & certifications</SectionTitle>
                      <ul className="list-none space-y-1.5 text-slate-800">
                        {(tailored.education || []).map((edu, i) => (
                          <li key={`e-${i}`}>{formatEdu(edu)}</li>
                        ))}
                        {(tailored.certifications || []).map((c, i) => (
                          <li key={`c-${i}`}>{cleanAtsCopy(c)}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {tailored.fit_notes && (
                    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Tailoring notes</p>
                      {cleanAtsCopy(tailored.fit_notes)}
                    </section>
                  )}

                  {tailored.keywords_used && tailored.keywords_used.length > 0 && (
                    <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-200 pt-4">
                      <span className="font-semibold text-slate-600">ATS keywords reflected: </span>
                      {tailored.keywords_used.map(cleanAtsCopy).join(', ')}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={exportSinglePagePdf}
                    className="mt-8 w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800"
                  >
                    <Download size={16} /> Download PDF (one page)
                  </button>
                </article>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
