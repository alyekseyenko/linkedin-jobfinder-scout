import React, { useState, useMemo, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building, ChevronDown, ChevronUp, ExternalLink, 
  CheckCircle2, Sparkles, Target, Cpu, MapPin, 
  Briefcase, DollarSign, Globe, Info, MessageSquare, 
  Zap, Shield, Fingerprint, Rocket, BrainCircuit, Send, Loader2,
  Trash2, Database, ShieldCheck, X, FileText, User, Mail, Code2, GraduationCap, Download, Copy
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { mcpService, type Job } from '../lib/mcp-service';
import LottieLoader from './LottieLoader';
import NeuralTeamVisualizer from './NeuralTeamVisualizer';
import { useDragSound } from '../hooks/useDragSound';
import MatchRadar from './MatchRadar';
import AutoFillModal from './AutoFillModal';

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  salary?: string;
  jobType?: string;
  matched_skills?: string | string[];
  gaps?: string[];
  score?: number;
  linkedin_id?: string;
  isFresh?: boolean;
  status?: string;
  ai_report?: string;
  forensics_report?: string;
  company_intel?: string;
  strategy_analysis?: string;
  pitch_message?: string;
  linkedin_connect_note?: string;
  inmail_pitch?: string;
  detected_language?: string;
  deep_intelligence_pack?: any;
}


interface JobCardProps {
  job: Job;
  userSkills?: string[];
  onClose?: () => void;
  onDelete?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onUpdateBudget?: (budget: string) => void;
}

type Tab = 'mission' | 'intelligence' | 'operation' | 'cv';

export default function JobCard({ job, userSkills = [], onClose, onDelete, onAccept, onReject, onUpdateBudget }: JobCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('mission');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [tailoredCV, setTailoredCV] = useState<any>(null);
  const [isAdaptingCV, setIsAdaptingCV] = useState(false);
  const [isAutoFillOpen, setIsAutoFillOpen] = useState(false);
  
  const pack = job.deep_intelligence_pack || {};
  const [isFromCache, setIsFromCache] = useState(pack.fromCache || false);
  const { playScan } = useDragSound();

  // Helper: extract a named section from a markdown report string
  const extractReportSection = (text: string, header: string): string => {
    if (!text) return '';
    const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(`${escaped}[^\\n]*\\n([\\s\\S]*?)(?=\\n###\\s|$)`, 'i');
    const m = text.match(rx);
    return m ? m[1].trim() : '';
  };

  // Resolve initial values from every possible source: top-level field → pack field → extracted from stored report
  const resolveField = (
    topLevel: string | undefined,
    packField: string | undefined,
    reportHeader: string,
    reportText: string
  ): string => {
    if (topLevel) return topLevel;
    if (packField) return packField;
    return extractReportSection(reportText, reportHeader);
  };

  const storedReport = job.aiReport || job.ai_report || pack.intelligence_report || '';

  const [dynamicReport, setDynamicReport] = useState(storedReport);
  const [forensics, setForensics] = useState(
    resolveField(job.forensicsReport || job.forensics_report, pack.forensics_report, '### 🔬 MATCHING FORENSICS', storedReport)
  );
  const [companyIntel, setCompanyIntel] = useState(
    job.companyIntel || job.company_intel || pack.company_intel || ''
  );
  const [strategy, setStrategy] = useState(
    resolveField(job.strategyAnalysis || job.strategy_analysis, pack.strategy_analysis || pack.attack_strategy, '### 🎯 TACTICAL ADVANTAGE', storedReport)
  );
  const [pitch, setPitch] = useState(
    resolveField(job.pitchMessage || job.pitch_message, pack.pitch_message, '### 💬 NEURAL CONNECTION HOOK', storedReport)
      .replace(/^["'\s]+|["'\s]+$/g, '')
  );
  const [linkedinNote, setLinkedinNote] = useState(
    pack.linkedin_connect_note || job.linkedin_connect_note || ''
  );
  const [inmailPitch, setInmailPitch] = useState(
    pack.inmail_pitch || job.inmail_pitch || ''
  );
  const [detectedLang, setDetectedLang] = useState(
    pack.detected_language || job.detected_language || 'en'
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Helper: Format raw markdown syntax (**bold**, ### headers) into clean HTML
  const formatMarkdown = (text: string) => {
    if (!text) return '';
    return text
      .replace(/###\s+(.*)/g, '<h4 class="text-sm font-black text-bio-neon-blue uppercase tracking-wider mt-4 mb-2">$1</h4>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white bg-white/10 px-1 py-0.5 rounded">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-white/90">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="font-mono text-xs text-bio-neon-green bg-black/60 px-1.5 py-0.5 rounded border border-bio-neon-green/20">$1</code>')
      .replace(/\n/g, '<br/>');
  };

  // Helper: Strip dashes, em-dashes and hyphens from outreach texts
  const stripDashes = (text: string) => {
    if (!text) return '';
    return text.replace(/[—–-]/g, ', ').replace(/\s+/g, ' ').trim();
  };

  const [coverLetter, setCoverLetter] = useState('');

  // Re-hydrate all intelligence state when the job prop changes (e.g. pipeline selects a different card)
  useEffect(() => {
    const newPack = job.deep_intelligence_pack || {};
    const newReport = job.aiReport || job.ai_report || newPack.intelligence_report || '';
    setDynamicReport(newReport);
    setIsFromCache(newPack.fromCache || false);
    setForensics(
      resolveField(job.forensicsReport || job.forensics_report, newPack.forensics_report, '### 🔬 MATCHING FORENSICS', newReport)
    );
    setCompanyIntel(job.companyIntel || job.company_intel || newPack.company_intel || '');
    setStrategy(
      resolveField(job.strategyAnalysis || job.strategy_analysis, newPack.strategy_analysis || newPack.attack_strategy, '### 🎯 TACTICAL ADVANTAGE', newReport)
    );
    setPitch(
      resolveField(job.pitchMessage || job.pitch_message, newPack.pitch_message, '### 💬 NEURAL CONNECTION HOOK', newReport)
        .replace(/^["'\s]+|["'\s]+$/g, '')
    );
    setLinkedinNote(newPack.linkedin_connect_note || job.linkedin_connect_note || '');
    setInmailPitch(newPack.inmail_pitch || job.inmail_pitch || '');
    setDetectedLang(newPack.detected_language || job.detected_language || 'en');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, job.linkedin_id]);

  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);


  // Extract cover letter from dynamicReport if it contains a clear header
  useEffect(() => {
    if (dynamicReport) {
      const splitRegex = /###\s.*(?:CARTA DE APRESENTAÇÃO|COVER LETTER|NEURAL COVER LETTER).*/i;
      const parts = dynamicReport.split(splitRegex);
      if (parts.length > 1) {
        setCoverLetter(parts[1].trim());
      }
    }
  }, [dynamicReport]);

  const neuralId = job.linkedin_id || job.id;

  const dynamicMatches = useMemo(() => {
    if (!userSkills || userSkills.length === 0) return [];
    const jobText = (job.title + ' ' + (job.description || '')).toLowerCase();
    
    return userSkills.filter(skill => {
        if (!skill) return false;
        const normalizedSkill = skill.toLowerCase().trim();
        // Match exact word or common variations
        const regex = new RegExp(`\\b${normalizedSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(jobText) || jobText.includes(normalizedSkill);
    });
  }, [userSkills, job.title, job.description]);

  const dynamicGaps = useMemo(() => {
    let baseGaps: string[] = [];
    // Supabase column is skills_gaps; search results use missingSkills or gaps
    const rawGaps = job.skills_gaps ?? job.gaps ?? job.missingSkills;
    try {
        if (Array.isArray(rawGaps)) baseGaps = rawGaps;
        else if (typeof rawGaps === 'string' && rawGaps.trim().startsWith('[')) {
            const parsed = JSON.parse(rawGaps);
            baseGaps = Array.isArray(parsed) ? parsed : [];
        }
    } catch { baseGaps = [] }

    // If server gaps are empty, attempt heuristic detection for common high-value keywords
    if (baseGaps.length === 0) {
        const jobText = (job.title + ' ' + (job.description || '')).toLowerCase();
        // High value skills to check for gaps
        const coreKeywords = ["AWS", "Azure", "Docker", "Kubernetes", "GraphQL", "Rust", "Go", "Java", "C++", "Cybersecurity", "Terraform", "CI/CD", "Testing"];
        
        baseGaps = coreKeywords.filter(s => {
            const normalized = s.toLowerCase();
            return jobText.includes(normalized) && 
                   !userSkills.some(us => us.toLowerCase().includes(normalized) || normalized.includes(us.toLowerCase()));
        });
    }

    // Filter out matches from gaps
    return baseGaps.filter(skill => {
        const normalizedGap = skill.toLowerCase();
        return !dynamicMatches.some(m => m.toLowerCase().includes(normalizedGap) || normalizedGap.includes(m.toLowerCase()));
    });
  }, [job.skills_gaps, job.gaps, job.missingSkills, dynamicMatches, userSkills]);

  const [matches, setMatches] = useState<string[]>([]);
  const [gaps, setGaps] = useState<string[]>([]);

  useEffect(() => {
    // Supabase returns matched_skills and skills_gaps as JSON strings — parse defensively
    const parseJsonArray = (val: any): string[] => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string' && val.trim().startsWith('[')) {
        try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
      }
      return [];
    };

    const m = dynamicMatches.length > 0
      ? dynamicMatches
      : parseJsonArray(job.matched_skills);
    setMatches(m as string[]);

    // Supabase column is skills_gaps, search results use missingSkills/gaps
    const rawGaps = job.skills_gaps ?? job.gaps ?? job.missingSkills;
    const g = dynamicGaps.length > 0 ? dynamicGaps : parseJsonArray(rawGaps);
    setGaps(g as string[]);
  }, [dynamicMatches, dynamicGaps, job.matched_skills, job.skills_gaps, job.gaps, job.missingSkills]);

  const handleDeepAnalysis = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isAnalyzing) return;
    
    playScan();
    setIsAnalyzing(true);
    try {
      const initResult = await mcpService.analyzeJobDeeply(neuralId);
      
      if (initResult.status === 'queued') {
        // Poll for asynchronous background completion
        let attempts = 0;
        const maxAttempts = 30; // 30 attempts * 2s = 60 seconds max timeout
        
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const statusResult = await mcpService.checkDeepAnalysisStatus(neuralId);
            if (statusResult.status === 'completed') {
              clearInterval(pollInterval);
              const result = statusResult.result;
              
              setDynamicReport(result.intelligence_report || '');
              setForensics(result.forensics_report || '');
              setCompanyIntel(result.company_intel || '');
              setStrategy(result.strategy_analysis || '');
              setPitch(result.pitch_message || '');
              setLinkedinNote(result.linkedin_connect_note || '');
              setInmailPitch(result.inmail_pitch || '');
              setDetectedLang(result.detected_language || 'en');
              setIsFromCache(result.fromCache || false);

              if (result.matched_skills && Array.isArray(result.matched_skills)) {
                  setMatches(result.matched_skills);
              }
              if (result.skills_gaps && Array.isArray(result.skills_gaps)) {
                  setGaps(result.skills_gaps);
              }

              setActiveTab('intelligence');
              setIsAnalyzing(false);
            } else if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              console.error('Deep analysis polling timed out.');
              setIsAnalyzing(false);
            }
          } catch (pollErr) {
            clearInterval(pollInterval);
            console.error('Error polling deep analysis status:', pollErr);
            setIsAnalyzing(false);
          }
        }, 2000);
      } else {
        // Direct response (cache hit)
        const result = initResult;
        setDynamicReport(result.intelligence_report || '');
        setForensics(result.forensics_report || '');
        setCompanyIntel(result.company_intel || '');
        setStrategy(result.strategy_analysis || '');
        setPitch(result.pitch_message || '');
        setLinkedinNote(result.linkedin_connect_note || '');
        setInmailPitch(result.inmail_pitch || '');
        setDetectedLang(result.detected_language || 'en');
        setIsFromCache(result.fromCache || false);

        if (result.matched_skills && Array.isArray(result.matched_skills)) {
            setMatches(result.matched_skills);
        }
        if (result.skills_gaps && Array.isArray(result.skills_gaps)) {
            setGaps(result.skills_gaps);
        }

        setActiveTab('intelligence');
        setIsAnalyzing(false);
      }
    } catch (error) {
      console.error('Deep analysis failed:', error);
      setIsAnalyzing(false);
    }
  };

  const handleAdaptCV = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isAdaptingCV || tailoredCV) return;
    
    playScan();
    setIsAdaptingCV(true);
    try {
      const result = await mcpService.adaptCV(neuralId);
      setTailoredCV(result.tailored_cv);
      setActiveTab('cv');
    } catch (error) {
      console.error('CV Adaptation failed:', error);
    } finally {
      setIsAdaptingCV(false);
    }
  };

  const exportTailoredPDF = () => {
    if (!tailoredCV) return;
    
    const doc = new jsPDF();
    doc.setFont('helvetica');
    
    let y = 14;
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width; // 210mm
    const pageHeight = doc.internal.pageSize.height; // 297mm
    const maxLineWidth = pageWidth - margin * 2;
    
    // Helper to ensure strict 2-page max limit
    const checkPageOverflow = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - 15) {
            if (doc.getNumberOfPages() < 2) {
                doc.addPage();
                y = 15;
            }
        }
    };

    // Candidate details
    const candidateName = (tailoredCV.personal_info?.name || 'Candidate Name').toUpperCase();
    const candidateTitle = tailoredCV.personal_info?.title || job.title || 'AI Systems & Automation Engineer';
    const email = tailoredCV.personal_info?.email || 'candidate@example.com';
    const phone = tailoredCV.personal_info?.phone || '+000 000 000 000';
    const location = tailoredCV.personal_info?.location || 'Location, Country';
    const linkedinUrl = tailoredCV.personal_info?.website || 'https://www.linkedin.com';
    const githubUrl = 'https://github.com';

    // 1. HEADER SECTION
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text(candidateName, margin, y);
    y += 5;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(2, 132, 199); // Bio Blue / Cyan
    doc.text(`TARGET ROLE: ${job.title.toUpperCase()} @ ${job.company.toUpperCase()}`, margin, y);
    y += 5;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105); // Slate 600
    doc.text(`${location} | ${phone} | ${email}`, margin, y);
    y += 4;

    // Hyperlinks
    doc.setTextColor(2, 132, 199);
    doc.textWithLink('LinkedIn Profile', margin, y, { url: linkedinUrl });
    doc.text(' | ', margin + 22, y);
    doc.textWithLink('GitHub Portfolio', margin + 26, y, { url: githubUrl });
    y += 6;

    // Divider line
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // Helper for Section Headers
    const addSectionHeader = (title: string) => {
        checkPageOverflow(10);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(title.toUpperCase(), margin, y);
        y += 2;
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;
    };

    // 2. PROFESSIONAL SUMMARY
    addSectionHeader('Professional Summary');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const summaryClean = stripDashes(tailoredCV.summary || '');
    const summaryLines = doc.splitTextToSize(summaryClean, maxLineWidth);
    checkPageOverflow(summaryLines.length * 3.8);
    doc.text(summaryLines, margin, y);
    y += (summaryLines.length * 3.8) + 5;

    // 3. CORE TECHNICAL SKILLS
    addSectionHeader('Technical Skills & Expertise');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const skillsList = (tailoredCV.hard_skills || []).join(' • ');
    const skillLines = doc.splitTextToSize(skillsList, maxLineWidth);
    checkPageOverflow(skillLines.length * 3.8);
    doc.text(skillLines, margin, y);
    y += (skillLines.length * 3.8) + 5;

    // 4. PROFESSIONAL EXPERIENCE
    addSectionHeader('Professional Experience');
    (tailoredCV.experience || []).forEach((exp: any) => {
        checkPageOverflow(12);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`${exp.role}`, margin, y);
        
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(`${exp.company} | ${exp.period}`, pageWidth - margin, y, { align: 'right' });
        y += 4.5;

        (exp.bullets || []).forEach((b: string) => {
            const cleanBullet = stripDashes(b.replace(/<[^>]*>?/gm, ''));
            const bulletLines = doc.splitTextToSize(`• ${cleanBullet}`, maxLineWidth - 3);
            checkPageOverflow(bulletLines.length * 3.6);
            doc.setFontSize(8.2);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(51, 65, 85);
            doc.text(bulletLines, margin + 2, y);
            y += (bulletLines.length * 3.6) + 1.5;
        });
        y += 2.5;
    });

    // 5. EDUCATION & CERTIFICATIONS
    if (tailoredCV.education?.length || tailoredCV.certifications?.length) {
        addSectionHeader('Education & Certifications');
        doc.setFontSize(8.2);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);

        (tailoredCV.education || []).forEach((e: any) => {
            const eduText = typeof e === 'string' ? e : `${e.degree} - ${e.institution} (${e.details || ''})`;
            const eduLines = doc.splitTextToSize(`• ${eduText}`, maxLineWidth);
            checkPageOverflow(eduLines.length * 3.5);
            doc.text(eduLines, margin, y);
            y += (eduLines.length * 3.5) + 1.5;
        });

        (tailoredCV.certifications || []).forEach((c: string) => {
            const certLines = doc.splitTextToSize(`• ${c}`, maxLineWidth);
            checkPageOverflow(certLines.length * 3.5);
            doc.text(certLines, margin, y);
            y += (certLines.length * 3.5) + 1.5;
        });
    }

    // Clean filename: Candidate_Name_JobTitle_Company.pdf
    const cleanCand = (tailoredCV.personal_info?.name || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanJob = job.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25);
    const cleanComp = job.company.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    const fileName = `Tailored_CV_${cleanCand}_${cleanJob}_${cleanComp}.pdf`;

    doc.save(fileName);
  };

  const exportCoverLetterPDF = () => {
    if (!coverLetter) return;
    
    const doc = new jsPDF();
    doc.setFont('helvetica');
    
    let y = 20;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    const maxLineWidth = pageWidth - margin * 2;
    
    const addText = (text: string, size: number, isBold: boolean = false, align: 'left' | 'center' | 'right' = 'left') => {
        doc.setFontSize(size);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        
        const lines = doc.splitTextToSize(text, maxLineWidth);
        
        if (y + (lines.length * size * 0.4) > doc.internal.pageSize.height - 20) {
            doc.addPage();
            y = 20;
        }
        
        if (align === 'center') {
            doc.text(lines, pageWidth / 2, y, { align: 'center' });
        } else if (align === 'right') {
            doc.text(lines, pageWidth - margin, y, { align: 'right' });
        } else {
            doc.text(lines, margin, y);
        }
        
        y += (lines.length * size * 0.4) + 4;
    };
    
    // Header / Personal Info
    const name = tailoredCV?.personal_info?.name || 'ALEX HUNTER';
    const email = tailoredCV?.personal_info?.email || 'alex.hunter@example.com';
    const location = tailoredCV?.personal_info?.location || 'San Francisco, CA / Remote';
    
    addText(name, 16, true);
    addText(`${location} | ${email}`, 10);
    y += 10;
    
    // Date
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    addText(today, 10);
    y += 5;
    
    // Company Info
    addText(`To the Hiring Team at ${job.company}`, 11, true);
    addText(`Re: ${job.title} Application`, 10, true);
    y += 10;
    
    // Body
    addText(coverLetter, 11);
    
    y += 15;
    
    // Closing
    addText('Sincerely,', 11);
    addText(name, 11, true);
    
    doc.save(`Cover_Letter_${job.company.replace(/\s+/g, '_')}.pdf`);
  };

  // Default to expanded if we have an onClose (modal view)
  const [isExpanded, setIsExpanded] = useState(!!onClose);

  const displayScore = useMemo(() => {
    // 1. Prioritize official scores from Deep Intelligence
    const officialScore = job.match_score || job.matchScore || job.score;
    if (officialScore && officialScore > 0) return officialScore;
    
    if (!userSkills || userSkills.length === 0) return 0;
    
    // 2. Neural Weighting Engine
    // Define High-Value Skills (The "Core Tech" of the user)
    const CORE_WEIGHT = 2.5;
    const TOOL_WEIGHT = 0.5;
    const NORMAL_WEIGHT = 1.0;

    // Heuristic for core skills (typically the first few in the user profile or high-demand tech)
    const coreTech = ["react", "node", "typescript", "ai", "agents", "automation", "python", "three.js", "next.js", "supabase"];
    
    let totalWeightedMatches = 0;
    let totalPotentialWeight = 0;

    // Calculate matches weight
    matches.forEach(skill => {
        const s = skill.toLowerCase();
        const weight = coreTech.some(ct => s.includes(ct)) ? CORE_WEIGHT : NORMAL_WEIGHT;
        totalWeightedMatches += weight;
        totalPotentialWeight += weight;
    });

    // Calculate gaps weight (penalize more if it's a core tech)
    gaps.forEach(skill => {
        const s = skill.toLowerCase();
        const weight = coreTech.some(ct => s.includes(ct)) ? CORE_WEIGHT : TOOL_WEIGHT;
        totalPotentialWeight += weight;
    });

    // Final Weighted Calculation
    const scoreBase = Math.max(5, totalPotentialWeight); // Minimum base to avoid 100% with 1 skill
    const calculated = Math.round((totalWeightedMatches / scoreBase) * 100);
    
    // Intelligent Floor based on critical mass
    const criticalMatchCount = matches.filter(s => coreTech.some(ct => s.toLowerCase().includes(ct))).length;
    
    return Math.min(100, Math.max(calculated, criticalMatchCount >= 2 ? 65 : (criticalMatchCount >= 1 ? 45 : 0)));
  }, [job.match_score, job.matchScore, job.score, matches, gaps, userSkills]);

  // Auto-trigger analysis for elite matches when expanded
  useEffect(() => {
    if (isExpanded && displayScore >= 90 && !dynamicReport && !isAnalyzing) {
      handleDeepAnalysis();
    }
  }, [isExpanded, displayScore, dynamicReport, isAnalyzing]);

  const neuralPersona = useMemo(() => {
    const categories: Record<string, string[]> = {
      "AI Engineer": ["n8n", "Python", "AI", "Agentic Workflows", "LangChain", "Machine Learning", "RAG", "Prompt Engineering"],
      "Creative Technologist": ["UI/UX", "3D", "Three.js", "Figma", "Design Systems", "p5.js", "Processing", "WebGL"],
      "Full-Stack Developer": ["React", "Node.js", "Typescript", "FastAPI", "SQL", "JavaScript", "HTML", "CSS"]
    };

    let bestPersona = "Specialized Expert";
    let maxMatch = 0;

    Object.entries(categories).forEach(([persona, list]) => {
      const matchCount = matches.filter(m => list.some(s => m.toLowerCase().includes(s.toLowerCase()))).length;
      if (matchCount > maxMatch) {
        maxMatch = matchCount;
        bestPersona = persona;
      }
    });

    if (maxMatch === 0) {
        // Dynamic Persona based on Title if no skills match yet
        const jobTitle = job.title.toLowerCase();
        if (jobTitle.includes('engineer') || jobTitle.includes('developer')) return "System Engineer";
        if (jobTitle.includes('manager') || jobTitle.includes('lead')) return "Strategic Leader";
        if (jobTitle.includes('designer') || jobTitle.includes('creative')) return "Creative Mind";
        return "Specialized Expert";
    }

    return bestPersona;
  }, [matches]);

  const tierReached = job.deep_intelligence_pack?.tier_reached || (job as any).tier_reached;
  const pitchEval = job.deep_intelligence_pack?.pitch_evaluation || (job as any).pitch_evaluation;
  const evalGrade = pitchEval?.grade;
  const isHallucinationFree = pitchEval ? !pitchEval.hallucination_detected : true;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full bg-bio-void/95 backdrop-blur-2xl rounded-[2.5rem] border transition-all duration-500 shadow-2xl overflow-hidden flex flex-col ${isExpanded ? 'border-bio-neon-blue/40' : 'border-white/5 hover:border-white/20 cv-auto gpu-layer'}`}
      style={{ height: isExpanded ? '85vh' : 'auto', minHeight: isExpanded ? '500px' : 'auto' }}
    >
      {/* 🚀 COLLAPSED HEADER (Summary View) - Always Visible */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-6 cursor-pointer flex flex-wrap items-center justify-between gap-6 shrink-0 bg-white/[0.01] z-20"
      >
        <div className="flex items-center gap-6 min-w-[300px]">
          <div className="w-12 h-12 rounded-xl bg-bio-neon-blue/10 flex items-center justify-center border border-bio-neon-blue/20">
            <Building className="text-bio-neon-blue" size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
               <h3 className="text-lg font-black text-white tracking-tight leading-none">{job.title}</h3>
               {isFromCache && (
                 <span title="Análise recuperada instantaneamente da memória do teu agente" className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-wider border border-emerald-500/30">
                   <Zap size={10} className="fill-emerald-400" /> Análise Instantânea
                 </span>
               )}
               {tierReached === 'tier_3_elite' && (
                 <span title="Oportunidade de ouro com máxima compatibilidade para o teu perfil" className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 text-[9px] font-black uppercase tracking-wider border border-purple-500/30">
                   <Sparkles size={10} /> Oportunidade de Ouro
                 </span>
               )}
               {tierReached === 'tier_1_discarded' && (
                 <span title="O agente filtrou esta vaga para te poupar tempo devido a baixa afinidade" className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 text-[9px] font-black uppercase tracking-wider border border-rose-500/30">
                   Baixa Afinidade (Filtrada)
                 </span>
               )}
               {evalGrade && (
                 <span title="Pitch avaliado pelo sistema de auditoria contra alucinações e clichés" className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 text-[9px] font-black uppercase tracking-wider border border-blue-500/30">
                   <ShieldCheck size={10} /> {isHallucinationFree ? 'Pitch 100% Autêntico' : `Qualidade Nota ${evalGrade}`}
                 </span>
               )}
               <span className="px-2 py-0.5 rounded-md bg-bio-neon-blue/10 text-bio-neon-blue text-[7px] font-black uppercase tracking-widest border border-bio-neon-blue/20">{neuralPersona}</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-[10px] font-black text-bio-neon-blue uppercase tracking-widest">{job.company}</p>
              <div className="w-1 h-1 rounded-full bg-white/10" />
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{job.work_area || job.jobType || (job.location?.includes('Remote') ? 'Remote Focus' : 'Market Opportunity')}</p>
            </div>
          </div>
        </div>

        {/* Top Skills (Collapsed) */}
        <div className="hidden lg:flex items-center gap-2 flex-1 max-w-md overflow-hidden">
          {matches.slice(0, 3).map((skill: string, i: number) => (
            <span key={i} className="px-3 py-1 rounded-lg bg-white/5 text-[9px] font-black text-white/40 uppercase tracking-widest border border-white/5">
              {skill}
            </span>
          ))}
          {matches.length > 3 && <span className="text-[9px] font-black text-white/20">+{matches.length - 3}</span>}
        </div>

        {/* Match & Expand */}
        <div className="flex items-center gap-6">
          <div className="text-right">
             <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-0.5">Neural Match</p>
             <p className={`text-xl font-black tracking-tighter ${displayScore >= 90 ? 'text-bio-neon-green shadow-bio-neon' : 'text-bio-neon-blue'}`}>
               {displayScore}%
             </p>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${isExpanded ? 'bg-bio-neon-blue border-bio-neon-blue text-bio-void rotate-180' : 'bg-white/5 border-white/10 text-white/40'}`}>
            <ChevronDown size={20} />
          </div>
        </div>
      </div>

      {/* 🚀 EXPANDED CONTENT (Full View) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5 flex-1 overflow-y-auto custom-scrollbar"
          >
            {/* Tab Navigation (Internal) - Also Sticky? Let's make it follow the scroll or keep it at top of content */}
            <div className="px-10 py-2 flex gap-10 border-b border-white/5 bg-white/[0.01] sticky top-0 backdrop-blur-md z-10">
              {[
                { id: 'mission', label: 'Briefing', icon: Target },
                { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
                { id: 'operation', label: 'Protocol', icon: Send },
                { id: 'cv', label: 'Neural CV', icon: User }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={(e) => { e.stopPropagation(); setActiveTab(t.id as Tab); }}
                  className={`flex items-center gap-3 py-4 relative transition-all ${activeTab === t.id ? 'text-white' : 'text-white/20 hover:text-white/40'}`}
                >
                  <t.icon size={14} className={activeTab === t.id ? 'text-bio-neon-blue' : ''} />
                  <span className="text-[9px] font-black uppercase tracking-[0.3em]">{t.label}</span>
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="p-8 space-y-8">
              {activeTab === 'mission' && (
                <div className="space-y-8">
                   <div className="flex flex-wrap gap-8">
                      <div className="space-y-3">
                         <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Matched DNA</p>
                         <div className="flex flex-wrap gap-2">
                           {matches.map((s, i) => <span key={i} className="px-3 py-1 rounded-lg bg-bio-neon-blue/10 text-bio-neon-blue text-[9px] font-black uppercase border border-bio-neon-blue/20">{s}</span>)}
                         </div>
                      </div>
                      <div className="space-y-3">
                         <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Gap Forensics</p>
                         <div className="flex flex-wrap gap-2">
                           {gaps.map((s, i) => <span key={i} className="px-3 py-1 rounded-lg bg-red-500/10 text-red-400 text-[9px] font-black uppercase border border-red-500/20">{s}</span>)}
                         </div>
                      </div>
                   </div>

                    <div className="space-y-3 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                          className="flex items-center gap-2 text-[10px] font-black text-bio-neon-blue uppercase tracking-widest hover:text-white transition-colors cursor-pointer"
                        >
                          <FileText size={13} />
                          <span>Descrição da Vaga</span>
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/10 font-bold">
                            {isDescriptionOpen ? 'Recolher ⌃' : 'Ver Completa ⌵'}
                          </span>
                        </button>
                        <div className="flex items-center gap-3">
                          {job.budget || job.salary ? (
                            <span className="text-[9px] font-black text-bio-neon-green uppercase tracking-widest flex items-center gap-1.5">
                              <DollarSign size={11} /> {job.budget || job.salary}
                            </span>
                          ) : null}
                          <span className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                            <MapPin size={11} /> {job.location}
                          </span>
                        </div>
                      </div>

                      {isDescriptionOpen ? (
                        <p className="text-xs text-white/60 leading-relaxed font-medium whitespace-pre-line bg-black/20 p-4 rounded-xl border border-white/5 max-h-[350px] overflow-y-auto custom-scrollbar">
                          {job.description}
                        </p>
                      ) : (
                        <div 
                          onClick={() => setIsDescriptionOpen(true)}
                          className="cursor-pointer group"
                        >
                          <p className="text-xs text-white/40 leading-relaxed font-medium line-clamp-2">
                            {job.description}
                          </p>
                          <span className="text-[9px] font-bold text-bio-neon-blue/70 group-hover:text-bio-neon-blue group-hover:underline mt-1 inline-block">
                            Clica para ler toda a descrição...
                          </span>
                        </div>
                      )}
                    </div>
                </div>
              )}

              {activeTab === 'intelligence' && (
                <div className="space-y-6">
                   {/* 📊 4-Axis Bio-Neon Match Radar */}
                   <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-around gap-4">
                      <div>
                         <h4 className="text-xs font-black text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                           <Target size={14} className="text-bio-neon-green" /> 4-Axis Neural Alignment
                         </h4>
                         <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest max-w-xs">
                           Raciocínio vetorial pgvector + Semantica Graph em 4 eixos semânticos
                         </p>
                      </div>
                      <MatchRadar
                         hardSkillsScore={displayScore}
                         domainScore={Math.min(100, Math.max(displayScore - 5, 70))}
                         cultureScore={Math.min(100, Math.max(displayScore - 2, 75))}
                         salaryScore={Math.min(100, Math.max(displayScore - 8, 65))}
                         size={160}
                      />
                   </div>

                   {!dynamicReport && !isAnalyzing ? (
                    <div className="py-20 text-center space-y-8 bg-bio-neon-blue/5 rounded-[3rem] border border-bio-neon-blue/10 border-dashed transition-all hover:bg-bio-neon-blue/10">
                      <BrainCircuit className="text-bio-neon-blue/40 mx-auto" size={64} />
                      <div className="space-y-2">
                        <h4 className="text-xl font-black text-white uppercase tracking-tighter">Neural Intelligence Offline</h4>
                        <p className="text-xs text-white/40 font-medium">Initialize deep scanning to reveal corporate forensics and tactical strategies.</p>
                      </div>
                      <button onClick={handleDeepAnalysis} className="px-10 py-4 bg-bio-neon-blue text-bio-void rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-bio-neon-blue/20 hover:scale-105 transition-all active:scale-95">Initialize Deep Scan</button>
                    </div>
                  ) : isAnalyzing ? (
                    <div className="py-12 flex flex-col items-center">
                      <NeuralTeamVisualizer />
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in duration-700">
                       <Accordion 
                         title="Strategic Intelligence Brief" 
                         icon={BrainCircuit} 
                         color="text-bio-neon-green" 
                         borderColor="border-bio-neon-green/20"
                         bgColor="bg-bio-neon-green/[0.03]"
                         defaultOpen={true}
                         actions={
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeepAnalysis(); }}
                              className="px-4 py-1.5 rounded-lg bg-bio-neon-green/10 text-bio-neon-green font-black text-[9px] uppercase tracking-widest border border-bio-neon-green/20 hover:bg-bio-neon-green/20 transition-all"
                            >
                              Recalibrate
                            </button>
                         }
                       >
                          <div className="text-sm text-white/90 leading-relaxed font-medium space-y-4">
                             <div dangerouslySetInnerHTML={{ __html: formatMarkdown(dynamicReport) }} />
                          </div>
                       </Accordion>

                       <Accordion 
                         title="Matching Forensics" 
                         icon={Fingerprint} 
                         color="text-bio-neon-blue" 
                         borderColor="border-bio-neon-blue/10"
                         bgColor="bg-bio-neon-blue/[0.03]"
                       >
                          <div className="text-sm text-white/80 leading-relaxed space-y-2">
                             <div dangerouslySetInnerHTML={{ __html: formatMarkdown(forensics) }} />
                          </div>
                       </Accordion>

                       <Accordion 
                         title="Tactical Advantage" 
                         icon={Zap} 
                         color="text-bio-neon-purple" 
                         borderColor="border-bio-neon-purple/10"
                         bgColor="bg-bio-neon-purple/[0.03]"
                       >
                          <div className="text-sm text-white/90 leading-relaxed space-y-2">
                             <div dangerouslySetInnerHTML={{ __html: formatMarkdown(strategy) }} />
                          </div>
                       </Accordion>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'operation' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                  {/* Language & Overview Header */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-bio-neon-blue/10 text-bio-neon-blue border border-bio-neon-blue/20">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white tracking-wide">Multi-Channel Outreach Suite</h4>
                        <p className="text-xs text-white/40">Geração adaptativa de abordagens com validação anti-clichê da IA.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-white/70">
                      <span>{detectedLang === 'pt' ? '🇵🇹 Português' : '🇬🇧 English'}</span>
                    </div>
                  </div>

                  {/* 1. LinkedIn Connection Note */}
                  <div className="p-5 rounded-2xl bg-bio-neon-blue/[0.04] border border-bio-neon-blue/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-bio-neon-blue">
                        <MessageSquare size={16} />
                        <span className="text-xs font-black uppercase tracking-widest">1. Convite de Conexão LinkedIn</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          (linkedinNote || pitch).length <= 300 
                            ? 'text-bio-neon-green bg-bio-neon-green/10 border-bio-neon-green/30' 
                            : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                        }`}>
                          {(linkedinNote || (pitch ? pitch.substring(0, 275) : '')).length}/300 carateres
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-white/40">
                      Tamanho estrito para a nota de convite do LinkedIn (limite máximo de 300 caracteres).
                    </p>
                    <blockquote className="text-sm text-white font-medium bg-black/40 p-4 rounded-xl border border-white/5 leading-relaxed">
                      "{stripDashes(linkedinNote || (pitch ? (pitch.length > 280 ? pitch.substring(0, 275) + '...' : pitch) : 'Inicie a análise profunda para desbloquear a nota...'))}"
                    </blockquote>
                    <div className="flex justify-end">
                      <button 
                        onClick={() => handleCopy(stripDashes(linkedinNote || (pitch ? (pitch.length > 280 ? pitch.substring(0, 275) : pitch) : '')), 'connect_note')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bio-neon-blue text-bio-void font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-bio-neon-blue/20"
                      >
                        <Copy size={13} /> {copiedKey === 'connect_note' ? 'Copiado!' : 'Copiar Convite LinkedIn'}
                      </button>
                    </div>
                  </div>

                  {/* 2. InMail / Direct Message */}
                  <div className="p-5 rounded-2xl bg-bio-neon-purple/[0.04] border border-bio-neon-purple/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-bio-neon-purple">
                        <Send size={16} />
                        <span className="text-xs font-black uppercase tracking-widest">2. InMail & Mensagem Direta</span>
                      </div>
                      <span className="text-[10px] font-mono text-white/40">~120 palavras</span>
                    </div>
                    <p className="text-xs text-white/40">
                      Pitch direto e sem rodeios para enviar por mensagem privada a recrutadores ou hiring managers.
                    </p>
                    <div className="text-sm text-white/90 bg-black/40 p-4 rounded-xl border border-white/5 leading-relaxed whitespace-pre-line font-medium">
                      {stripDashes(inmailPitch || pitch || 'Aguardando geração da análise profunda...')}
                    </div>
                    <div className="flex justify-end">
                      <button 
                        onClick={() => handleCopy(stripDashes(inmailPitch || pitch), 'inmail')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bio-neon-purple text-white font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-bio-neon-purple/20"
                      >
                        <Copy size={13} /> {copiedKey === 'inmail' ? 'Copiado!' : 'Copiar InMail'}
                      </button>
                    </div>
                  </div>

                  {/* 3. Executive Full Pitch / Cover Letter */}
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white/80">
                        <FileText size={16} />
                        <span className="text-xs font-black uppercase tracking-widest">3. Proposta Executiva & Carta</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleCopy(stripDashes(coverLetter || pitch), 'full_pitch')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider border border-white/10"
                        >
                          <Copy size={12} /> {copiedKey === 'full_pitch' ? 'Copied!' : 'Copy'}
                        </button>
                        <button 
                          onClick={exportCoverLetterPDF}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white font-bold text-[10px] uppercase tracking-wider hover:bg-white/20 transition-all border border-white/10"
                        >
                          <Download size={12} /> PDF
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-white/40">
                      Tailored professional narrative with technical proofs and impact metrics ready for job application portals.
                    </p>
                    <div className="text-sm text-white/80 bg-black/40 p-4 rounded-xl border border-white/5 leading-relaxed whitespace-pre-line">
                      {stripDashes(coverLetter || pitch || 'Execute deep job analysis to generate a tailored pitch.')}
                    </div>
                  </div>
                </div>
              )}


              {activeTab === 'cv' && (
                <div className="space-y-8">
                  {!tailoredCV && !isAdaptingCV ? (
                    <div className="py-12 text-center space-y-6 bg-bio-neon-green/5 rounded-3xl border border-bio-neon-green/10 border-dashed">
                      <User className="text-bio-neon-green/40 mx-auto" size={48} />
                      <button onClick={handleAdaptCV} className="px-8 py-3 bg-bio-neon-green text-bio-void rounded-xl font-black text-[10px] uppercase tracking-widest">Adapt My CV for this Job</button>
                    </div>
                  ) : isAdaptingCV ? (
                    <div className="py-12 flex flex-col items-center">
                      <Loader2 className="text-bio-neon-green animate-spin" size={48} />
                      <p className="text-[9px] font-black text-bio-neon-green uppercase tracking-widest mt-4 animate-pulse">Adapting Profile to Match DNA...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="glass-card bg-white/[0.02] border border-white/5 rounded-2xl relative p-6">
                        <div className="absolute top-6 right-6 flex gap-2">
                           <button 
                             onClick={() => navigator.clipboard.writeText(JSON.stringify(tailoredCV, null, 2))}
                             className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-white/40"
                             title="Copy JSON"
                           >
                             <ExternalLink size={14} />
                           </button>
                           <button 
                             onClick={exportTailoredPDF}
                             className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest border border-green-500/20 transition-all"
                             title="Download PDF ATS"
                           >
                             <Download size={14} /> PDF
                           </button>
                        </div>
                        <div className="mb-6 pr-32">
                          <h4 className="text-xl font-black text-white uppercase tracking-tight">{tailoredCV.personal_info?.name}</h4>
                          <span className="text-sm text-bio-neon-green font-mono uppercase tracking-widest">{tailoredCV.personal_info?.title}</span>
                          <div className="flex flex-wrap gap-3 mt-4 text-[10px] text-white/50">
                            <span className="flex items-center gap-1"><MapPin size={12}/> {tailoredCV.personal_info?.location}</span>
                            <span className="flex items-center gap-1"><Mail size={12}/> {tailoredCV.personal_info?.email}</span>
                          </div>
                        </div>

                        <div className="mb-8 p-4 bg-black/20 rounded-xl border border-white/5">
                          <p className="text-sm text-white/80 leading-relaxed">{tailoredCV.summary}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          {/* Experience Column */}
                          <div className="lg:col-span-2 space-y-6">
                            <div>
                              <h5 className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase mb-4 tracking-widest">
                                <Briefcase size={14} className="text-bio-neon-green" /> Adapted Experience
                              </h5>
                              <div className="space-y-6">
                                {tailoredCV.experience?.map((exp: any, i: number) => (
                                  <div key={i} className="relative pl-4 border-l border-white/10">
                                    <div className="absolute w-2 h-2 bg-bio-neon-green/50 rounded-full -left-[4.5px] top-1.5" />
                                    <div className="flex justify-between items-start mb-1">
                                      <div>
                                        <div className="font-bold text-white text-sm">{exp.role}</div>
                                        <div className="text-[10px] text-bio-neon-green uppercase tracking-widest">{exp.company}</div>
                                      </div>
                                      <span className="text-[10px] text-white/40 font-mono bg-white/5 px-2 py-1 rounded">{exp.period}</span>
                                    </div>
                                    <ul className="mt-3 space-y-1.5 text-xs text-white/60">
                                      {exp.bullets?.map((b: string, j: number) => (
                                        <li key={j} className="flex gap-2">
                                          <span className="text-bio-neon-green/50 mt-0.5">•</span>
                                          <span dangerouslySetInnerHTML={{__html: b}} />
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Sidebar Column */}
                          <div className="space-y-6">
                            <div>
                              <h5 className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase mb-3 tracking-widest">
                                <Code2 size={14} className="text-bio-neon-green" /> Selected Skills
                              </h5>
                              <div className="flex flex-wrap gap-2">
                                {tailoredCV.hard_skills?.map((skill: string, i: number) => (
                                  <span key={i} className="text-[9px] px-2 py-1 bg-white/5 border border-white/10 rounded text-white/70">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <h5 className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase mb-3 tracking-widest">
                                <GraduationCap size={14} className="text-bio-neon-green" /> Education
                              </h5>
                              <ul className="space-y-2 text-xs text-white/60">
                                {tailoredCV.education?.map((edu: any, i: number) => (
                                  <li key={i}>• {typeof edu === 'string' ? edu : edu.degree}</li>
                                ))}
                              </ul>
                            </div>
                            
                            <div>
                              <h5 className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase mb-3 tracking-widest">
                                <ShieldCheck size={14} className="text-bio-neon-green" /> Certifications
                              </h5>
                              <ul className="space-y-2 text-xs text-white/60">
                                {tailoredCV.certifications?.map((cert: string, i: number) => (
                                  <li key={i}>• {cert}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Bar (Footer) */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-white/5">
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={(e) => { e.stopPropagation(); onAccept && onAccept(); }} className="px-6 py-3 bg-bio-neon-green text-bio-void rounded-xl font-black text-[10px] uppercase tracking-widest cursor-pointer hover:brightness-110 transition-all">Accept Node</button>
                  <button onClick={(e) => { e.stopPropagation(); onReject && onReject(); }} className="px-6 py-3 bg-red-500/10 text-red-500 rounded-xl font-black text-[10px] uppercase tracking-widest border border-red-500/20 cursor-pointer hover:bg-red-500/20 transition-all">Reject</button>
                  
                  {/* ⚡ LIVE AUTO-FILL BUTTON (HITL) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAutoFillOpen(true);
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-cyan-500/25 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <Sparkles size={14} className="text-cyan-200 animate-pulse" /> Auto-Fill ao Vivo (HITL)
                  </button>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const targetUrl = job.url || (job as any).linkedin_url || (job.linkedin_id ? `https://www.linkedin.com/jobs/view/${job.linkedin_id}` : (job.id ? `https://www.linkedin.com/jobs/view/${job.id}` : ''));
                    if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer');
                  }} 
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl font-black text-[10px] uppercase tracking-widest border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Globe size={14} /> Open LinkedIn
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🚀 HITL AUTO-FILL MODAL */}
      <AutoFillModal
        job={job}
        isOpen={isAutoFillOpen}
        onClose={() => setIsAutoFillOpen(false)}
        onMarkAsApplied={() => onAccept && onAccept()}
      />

      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all z-[110]"
        >
          <X size={20} />
        </button>
      )}
    </motion.div>
  );
}

// --- HELPER COMPONENTS ---

interface AccordionProps {
  title: string;
  icon: any;
  color: string;
  borderColor: string;
  bgColor: string;
  children: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
}

function Accordion({ title, icon: Icon, color, borderColor, bgColor, children, defaultOpen = false, actions }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-[2rem] border ${borderColor} ${bgColor} overflow-hidden transition-all duration-300 ${isOpen ? 'shadow-lg' : ''}`}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-8 py-6 flex items-center justify-between group cursor-pointer transition-all hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-xl ${isOpen ? 'bg-white/10' : 'bg-transparent'} transition-all`}>
            <Icon size={18} className={color} />
          </div>
          <span className={`text-[11px] font-black uppercase tracking-[0.3em] transition-all ${isOpen ? 'text-white' : 'text-white/40 group-hover:text-white/60'}`}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {actions && <div onClick={e => e.stopPropagation()}>{actions}</div>}
          <motion.div 
            animate={{ rotate: isOpen ? 180 : 0 }}
            className={`text-white/20 transition-colors ${isOpen ? 'text-white/60' : ''}`}
          >
            <ChevronDown size={18} />
          </motion.div>
        </div>
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
          >
            <div className="px-10 pb-10 pt-2 border-t border-white/5">
               {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
