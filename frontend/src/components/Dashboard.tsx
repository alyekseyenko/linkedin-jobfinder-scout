import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger)
import { AmbientBackground, BentoCard, EditorialHeader, PillButton } from './ui/design-system'
import JobCard from './JobCard'
import SearchConfig, { type SearchConfig as SearchConfigType } from './SearchConfig'
import MarketIntelligence from './MarketIntelligence'
import { Skeleton } from './ui/skeleton'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import DigitalTwinVault from './DigitalTwinVault'
import NeuralMemoryGraph from './NeuralMemoryGraph'
import Layout from './Layout'
import { AutopilotPanel } from './AutopilotPanel'
import { VisionEnginePanel } from './VisionEnginePanel'
import { type MeshState } from './MeshGradient'
import { mcpService, type Job, type Profile } from '../lib/mcp-service'
import {
  AlertCircle,
  CheckCircle,
  RefreshCcw,
  RotateCcw,
  Link2,
  Loader2,
  Sparkles,
  BrainCircuit,
  Zap,
  Cpu,
  Binary,
  Search,
  Fingerprint,
  ChevronDown,
  Newspaper,
  Globe,
  Briefcase,
  Settings,
  Eye,
  EyeOff,
  Activity,
  Shield,
  Database
} from 'lucide-react'
import { useVisualSettings } from '../context/VisualSettingsContext'
import NeuralLoader from './NeuralLoader'
import NeuralVaultLoader from './NeuralVaultLoader'
import Lenis from '@studio-freight/lenis'
import NeuralCursor from './NeuralCursor'
import SystemDiagnostics from './SystemDiagnostics'

// Universal deduplicator for job feeds: enforces unique IDs and unique (Title + Company) pairs
function deduplicateJobs<T extends { id?: any; linkedin_id?: any; title?: string; company?: string }>(jobsList: T[]): T[] {
  if (!Array.isArray(jobsList)) return [];
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const cleanList: T[] = [];

  for (const job of jobsList) {
    if (!job) continue;
    const rawId = (job.linkedin_id || job.id)?.toString().trim();
    const cleanTitle = (job.title || '')
      .toLowerCase()
      .replace(/\(m\/f\/d\)/g, '')
      .replace(/\(f\/m\/d\)/g, '')
      .replace(/\(h\/m\)/g, '')
      .replace(/[^a-z0-9]/g, '');
    const cleanCompany = (job.company || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const fingerprint = `${cleanTitle}___${cleanCompany}`;

    if (rawId && seenIds.has(rawId)) continue;
    if (fingerprint.length > 5 && seenFingerprints.has(fingerprint)) continue;

    if (rawId) seenIds.add(rawId);
    if (fingerprint.length > 5) seenFingerprints.add(fingerprint);
    cleanList.push(job);
  }

  return cleanList;
}

const TRANSLATIONS: Record<string, any> = {
  // --- Projects ---
  "Alygen SaaS CRM": {
    title: "Alygen SaaS CRM — Agentic Market Intelligence",
    description: "Proprietary platform using autonomous agents (LangChain) for B2B predictive lead scoring and automated sales orchestration."
  },
  "ZohoSync": {
    title: "ZohoSync — Enterprise CRM Automation",
    description: "Robust middleware integrating Cegid PHC and Zoho CRM, managing €10M+ in transactions with 99.9% data integrity."
  },
  "Indomitable Echoes": {
    title: "Indomitable Echoes — PCD@Coimbra 2026",
    description: "Interactive installation visualizing Antero de Quental's poetry through real-time generative algorithms and NLP."
  },
  "A Sua Essência": {
    title: "A Sua Essência — E-commerce Intelligence",
    description: "Professional WordPress/WooCommerce system with full business automation, Moloni API, and technical SEO."
  },
  "Advanced Gift Manager": {
    title: "Advanced Gift Manager v4.0",
    description: "High-performance WooCommerce plugin for gift personalization and smart marketing automation."
  },
  "Design de Caixa BALANCE": {
    title: "BALANCE — Systemic Branding",
    description: "Functional and aesthetic packaging design system for a creative collection, focusing on visual identity."
  },
  "Verité – Luxury Hospitality": {
    title: "Verité — Luxury Hospitality Platform",
    description: "High-performance digital ecosystem for fine dining, focused on SEO and premium visual storytelling."
  },
  "ARKITEK – Modern Flooring": {
    title: "ARKITEK — Industrial E-commerce",
    description: "Strategic branding and architectural webstore for modern flooring solutions."
  },
  "Neural Hearth": {
    title: "Neural Hearth — Autonomous Identity Engine",
    description: "Meta-engineered AI dashboard that autonomically synchronizes professional authority through multi-agent orchestration and MCP integration."
  },

  // --- Certifications ---
  "Professional Scrum Master™ I (PSM I)": "Professional Scrum Master™ I (PSM I)",
  "Google UX Design Professional": "Google UX Design Professional",
  "Generative AI Leader": "Generative AI Leader",
  "Search Engine Optimization (SEO)": "Search Engine Optimization (SEO) - UC Davis",
  "SEO Masterclass With AI SEO: Beginner To Advanced": "AI SEO Masterclass - Alex Genadinik",
  "Adobe Content Creator: Launching Your Creative Career": "Adobe Content Creator Professional",
  "IBM AI Product Manager": "IBM AI Product Manager",
  "Advanced Marketing Optimization & Strategy": "Advanced Marketing Strategy - Coursera",
  "Machine Learning": "Machine Learning - Stanford / DeepLearning.AI",
  "Google IT Automation with Python": "Google IT Automation with Python",
  "Fullstack Development Specialization": "Fullstack Development - Scrimba",
  "Google Project Management": "Google Project Management Professional",
  "Google Digital Marketing & E-commerce": "Google Digital Marketing & E-commerce",
  "Google Advanced Data Analytics": "Google Advanced Data Analytics Professional",
  "AI-Powered Content Marketing and Strategy": "AI Content Strategy - Adobe",
  "Google Data Analytics Professional": "Google Data Analytics Professional",
  "AI & Automation": "AI & Automation",
  "Creative & Design": "Creative & Design",
  "Software Engineering": "Software Engineering",
  "Strategic & Management": "Strategic & Management"
};

const EXPERIENCE_TRANSLATIONS: Record<string, string> = {
  "Lead Designer & Digital Growth Specialist @ HABITARMOS": "Lead Designer & Digital Growth Specialist @ HABITARMOS",
  "Digital Transformation Lead for ARKITEK & SKUBA. Orchestrated e-commerce ecosystems and CRM/ERP automation to bridge commercial goals with technical execution.": "Digital Transformation Lead for ARKITEK & SKUBA. Orchestrated e-commerce ecosystems and CRM/ERP automation to bridge commercial goals with technical execution.",
  "Sr. Solutions Architect & Full-Stack Engineer @ ALYGEN | AI & AUTOMATION LABS": "Sr. Solutions Architect & Full-Stack Engineer @ ALYGEN | AI & AUTOMATION LABS",
  "Architected high-performance systems and proprietary CRM platforms with agentic automation. Integrated LangChain and RAG architectures for intelligent data processing.": "Architected high-performance systems and proprietary CRM platforms with agentic automation. Integrated LangChain and RAG architectures for intelligent data processing."
};

const translateProject = (proj: any) => {
  const trans = TRANSLATIONS[proj.title];
  if (trans && typeof trans === 'object') {
    return { ...proj, title: trans.title, description: trans.description };
  }
  return proj;
};

const t = (text: string) => {
  if (!text) return text;
  const trans = TRANSLATIONS[text];
  if (trans && typeof trans === 'object') return trans.title || text;
  return trans || text;
};


const INITIAL_DNA = `I am a Creative Technologist and Solutions Architect with 13+ years of expertise in creating high-performance digital ecosystems and AI-driven workflows. The fusion of digital art and agentic automation is fundamental to innovation and sustainable growth. My work involves creating innovative solutions that integrate strategic design, software engineering, and artificial intelligence to maximize efficiency, scalability, and conversion. Interactive digital art is an area of great interest to me, and projects like HUMANITY—which explores the intersection between playful aesthetics and generative visual expression—demonstrate the fusion of art and technology.

- Development of Automated Systems and AI
- Cloud Architecture and Systems Automation
- Web Engineering and Full-Stack Development
- n8n Automation
- Agentic Workflows in Python
- Machine Learning Model Development
- Supabase Integration
- 60FPS React Dashboards
- AI, Cloud & Systems Automation: LangChain, RAG Architecture, Prompt Engineering, AWS (Lambda/S3), Google Cloud, Docker, Python (NumPy/Pandas), Vector Databases, n8n
- Development of Interactive Digital Art`;

export default function Dashboard() {
  const [searchConfig, setSearchConfig] = useState<SearchConfigType>(() => {
    const saved = localStorage.getItem('skillhunter_config')
    const parsed = saved ? JSON.parse(saved) : null;
    if (parsed && parsed.keywords && parsed.keywords !== 'Software Engineer' && parsed.keywords !== 'Creative Technologist') {
      return parsed;
    }
    return {
      keywords: 'AI Systems & Automation Engineer',
      location: 'Portugal',
      experience: ['Senior', 'Mid-Level'],
      skills: [],
      jobType: ['Full-time'],
      remote: true,
      workMode: 'remote'
    }
  })

  const [jobs, setJobs] = useState<Job[]>([])
  const [liveJobs, setLiveJobs] = useState<Job[]>([])
  const [dbJobs, setDbJobs] = useState<Job[]>([])
  const [jobTab, setJobTab] = useState<'live' | 'db'>('live')
  const [isAutopilotModalOpen, setIsAutopilotModalOpen] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [mcpStatus, setMcpStatus] = useState<{ mcpReady: boolean; status: string }>({ mcpReady: false, status: 'checking' })
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [portfolioText, setPortfolioText] = useState(() => localStorage.getItem('skillhunter_portfolio') || INITIAL_DNA)
  const [portfolioUrl, setPortfolioUrl] = useState(() => localStorage.getItem('skillhunter_url') || '')
  const [appInitializing, setAppInitializing] = useState(true)
  const [expertIdentity, setExpertIdentity] = useState<any>(null)
  const [knowledgeBase, setKnowledgeBase] = useState<any>(null)
  const [showVault, setShowVault] = useState(false)
  const [showNeuralGraph, setShowNeuralGraph] = useState(false)
      const [isLearning, setIsLearning] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [searchMessage, setSearchMessage] = useState('Establishing Market Frequency...')
  const [ingestionProgress, setIngestionProgress] = useState('')
  const [groqKey, setGroqKey] = useState(() => localStorage.getItem('skillhunter_groq') || '')
  const [vaultSuccess, setVaultSuccess] = useState(false)
  const [meshState, setMeshState] = useState<MeshState>('idle')
        const [isBackgroundLearning, setIsBackgroundLearning] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [pollingAttempt, setPollingAttempt] = useState(0)
  const [reflectionLogs, setReflectionLogs] = useState<Array<{ id: string, type: 'info' | 'critical' | 'sync' | 'kpi', message: string, timestamp: string }>>([
    { id: '2', type: 'critical', message: "Agentic Protocol 2026 engaged. Strategic Brain online.", timestamp: new Date().toLocaleTimeString() }
  ])
  const [isResetting, setIsResetting] = useState(false)
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false)
  const [liveJobCount, setLiveJobCount] = useState(0)
  const [newJobsAlert, setNewJobsAlert] = useState(false)
  const [memories, setMemories] = useState<any[]>([])
  const [isDeepMapping, setIsDeepMapping] = useState(false)
  const [isVisionInitializing, setIsVisionInitializing] = useState(false)
  const [isVisionActive, setIsVisionActive] = useState(false)
  const [isVisionHunting, setIsVisionHunting] = useState(false)
  const [showAuthError, setShowAuthError] = useState(false)
  const [matchFilter, setMatchFilter] = useState<'all' | 'high'>('all')

  // ── NEURAL AUTOPILOT STATE ─────────────────────────────────
  const [autopilot, setAutopilot] = useState<{
    enabled: boolean;
    dailyLimit: number;
    intervalHours: number;
    maxPages: number;
    todayCount: number;
    totalJobsFound: number;
    lastRunAt: string | null;
    nextRunAt: string | null;
  } | null>(null)
  const [autopilotLoading, setAutopilotLoading] = useState(false)
  const [autopilotLimitInput, setAutopilotLimitInput] = useState(3)
  const [autopilotIntervalInput, setAutopilotIntervalInput] = useState(6)
  const [autopilotPagesInput, setAutopilotPagesInput] = useState(1)

  // ── AUTOPILOT VISIBILITY TRACKING ────────────────────────
  const autopilotPanelRef = useRef<HTMLDivElement>(null)
  const [isPanelVisible, setIsPanelVisible] = useState(false) // Start as false to show widget if enabled

  useEffect(() => {
    // Initial check after a short delay to let layout settle
    const timer = setTimeout(() => {
      if (autopilotPanelRef.current) {
        const rect = autopilotPanelRef.current.getBoundingClientRect()
        const visible = rect.top < window.innerHeight && rect.bottom > 0
        setIsPanelVisible(visible)
      }
    }, 500)

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsPanelVisible(entry.isIntersecting)
      },
      { threshold: 0.01 } // More sensitive threshold
    )

    if (autopilotPanelRef.current) observer.observe(autopilotPanelRef.current)
    
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [autopilot?.enabled, autopilotLoading]) // Re-run when status or loading changes

  const [isSyncing, setIsSyncing] = useState(false)

  const addLog = (message: string, type: 'info' | 'critical' | 'sync' | 'kpi' = 'info') => {
    setReflectionLogs(prev => [
      { id: Math.random().toString(36).substr(2, 9), type, message, timestamp: new Date().toLocaleTimeString() },
      ...prev.slice(0, 14)
    ])
  }

  const triggerProfilePolling = useCallback((durationMs = 90000) => {
    setIsPolling(true);
    setIsBackgroundLearning(true);

    // Track the timestamp before we started
    const initialTimestamp = knowledgeBase?.lastUpdated || new Date(0).toISOString();
    console.log(`[Neural Sync] Starting poll. Waiting for update newer than: ${initialTimestamp}`);

    const MAX_POLL_ATTEMPTS = 100;
    const POLL_INTERVAL = 10000; // 10s
    let attempts = 0;
    const maxAttempts = MAX_POLL_ATTEMPTS;

    const interval = setInterval(async () => {
      attempts++;
      setPollingAttempt(attempts);
      console.log(`[Neural Sync] Polling Attempt ${attempts}/${maxAttempts}...`);

      try {
        const kb = await mcpService.getExpertProfile();

        // If the timestamp is newer, or if we had nothing and now we have something
        const isNewer = new Date(kb.lastUpdated || 0) > new Date(initialTimestamp);
        const hasFirstData = !expertIdentity && kb.identity && kb.identity.summary;

        if (isNewer || hasFirstData) {
          console.log('[Neural Sync] New Intelligence detected in pipeline.');
          const normalized = Array.isArray(kb.identity) ? (kb.identity[0] || {}) : kb.identity;
          setExpertIdentity(normalized);
          setKnowledgeBase(kb);

          // Once we have a newer timestamp, we are confident synthesis finished
          setIsPolling(false);
          setIsBackgroundLearning(false);
          clearInterval(interval);
        }
      } catch (e) {
        console.error('[Neural Sync] Poll error:', e);
      }

      if (attempts >= maxAttempts) {
        setIsPolling(false);
        setIsBackgroundLearning(false);
        clearInterval(interval);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [knowledgeBase?.lastUpdated, expertIdentity]);

  const groupedTraits = useMemo(() => {
    const categories: Record<string, string[]> = {
      "ENGINE (Intelligence)": ["n8n", "Python", "AI", "Agentic Workflows", "LangChain", "Machine Learning", "RAG", "Prompt Engineering", "ChromaDB", "Pinecone", "LLM Fine-tuning", "Vector Databases", "NumPy", "Pandas", "Ensemble Learning", "MCP (Model Context Protocol)", "Agentic UI", "Artificial Intelligence", "NLP", "Automation", "Webhooks", "ZohoSync", "Discord Bots"],
      "AURA (Aesthetics)": ["UI/UX", "3D", "Three.js", "React Three Fiber", "framer-motion", "GSAP", "3D Interactive Dashboards", "Neural Motion Design", "Figma", "Design Systems", "Adobe Creative Cloud", "Photoshop", "Illustrator", "After Effects", "Premiere Pro", "InDesign", "Cinema 4D", "Motion Design", "p5.js", "Processing", "WebGL", "Interactive Digital Art", "Creative & Design", "Fotografia Profissional", "3ds Max"],
      "STRATEGY (Impact)": ["Scrum Master", "Agile", "AEO", "SEO", "Strategic Branding", "CRO", "Data Analytics", "CRM Strategy", "Predictive Lead Scoring", "B2B", "E-commerce", "ERP Integration", "Notion", "Criatividade", "Liderança de Projetos", "ROI", "Business Intelligence", "Strategic & Management", "Storytelling", "Gestão de Conflitos", "Data Storytelling", "KPI Visualization", "Colaboração", "Resiliência"],
      "CORE TECH": ["React", "Node.js", "Typescript", "FastAPI", "AWS", "GCP", "Git", "SQL", "JavaScript", "HTML", "CSS", "Vercel", "REST API", "GraphQL", "Supabase Integration", "60FPS React Dashboards", "Tailwind CSS", "Headless CMS", "PostgreSQL", "Software Engineering", "Cloud", "Docker", "Full-stack", "WordPress", "PHP", "Word", "Excel"]
    };

    const result: Record<string, string[]> = {};

    // Combine search skills with AI-learned skills from Expert Identity
    const learnedSkills = expertIdentity?.skills || [];
    const searchSkills = searchConfig?.skills || [];
    const allUniqueSkills = Array.from(new Set([...learnedSkills, ...searchSkills]));

    allSkills: for (const skill of allUniqueSkills) {
      if (!skill) continue;

      // Try to find a logical domain
      for (const [cat, list] of Object.entries(categories)) {
        if (list.some(s => s.toLowerCase() === skill.toLowerCase() || skill.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(skill.toLowerCase()))) {
          if (!result[cat]) result[cat] = [];
          result[cat].push(skill);
          continue allSkills;
        }
      }

      // Fallback: Default to CORE TECH to keep the constellation clean
      if (!result["CORE TECH"]) result["CORE TECH"] = [];
      result["CORE TECH"].push(skill);
    }
    return result;
  }, [searchConfig?.skills, expertIdentity?.skills]);


  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([fetchProfile(), fetchInitialJobs()])
      } catch (e) {
        console.error('Initialization warning:', e)
      } finally {
        // Guarantee loading ends even if profile fetch fails
        setTimeout(() => setAppInitializing(false), 2500)
      }
    }
    init()

    // Initialize Lenis Smooth Scroll
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      infinite: false,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    // Sync GSAP ScrollTrigger with Lenis
    lenis.on('scroll', ScrollTrigger.update)

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000)
    })

    return () => {
      lenis.destroy()
      gsap.ticker.remove(() => { })
    }
  }, [])

  const fetchInitialJobs = async (silent = false) => {
    try {
      const allJobs = await mcpService.fetchCRMJobs();
      // Sort chronologically: newest at the top, oldest at the bottom
      const discovered = deduplicateJobs(allJobs
        .filter(j => j.status === 'discovered' || !j.status)
        .sort((a, b) => {
          const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
          const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
          return timeB - timeA;
        }));
      
      setDbJobs(discovered as any);
      setJobs(discovered as any);
      setLiveJobCount(discovered.length);
    } catch (e) {
      console.error('Failed to fetch initial jobs:', e);
    }
  };

  // Live polling: every 30s fetch discovered jobs from Supabase
  useEffect(() => {
    const interval = setInterval(() => fetchInitialJobs(true), 30000);
    return () => clearInterval(interval);
  }, []);

  // BUG 3 FIX: Unified profile loading — only one function, called once
  const fetchProfile = async () => {
    try {
      const kb = await mcpService.getExpertProfile()
      setKnowledgeBase(kb)
      // kb expertProfile synced
      // BUG 2 FIX: Accept ANY identity object, not just ones with .summary
      if (kb.identity) {
        const normalizedIdentity = Array.isArray(kb.identity) ? (kb.identity[0] || {}) : kb.identity
        setExpertIdentity(normalizedIdentity)
        const targetTitle = normalizedIdentity.industryNiche || normalizedIdentity.title;
        if (targetTitle) {
          setSearchConfig(prev => ({
            ...prev,
            keywords: (!prev.keywords || prev.keywords === 'Software Engineer' || prev.keywords === 'Creative Technologist') ? targetTitle : prev.keywords
          }))
        }
      }
      if (kb.skills && kb.skills.length > 0) {
        setSearchConfig(prev => ({
          ...prev,
          skills: [...new Set([...prev.skills, ...kb.skills])]
        }))
      }
    } catch (error) {
      console.error('Failed to load expert KB:', error)
    }
  }

  
  useEffect(() => {
    localStorage.setItem('skillhunter_config', JSON.stringify(searchConfig))
  }, [searchConfig])

  useGSAP(() => {
    const sections = gsap.utils.toArray('.phase-section');

    sections.forEach((section: any, i) => {
      // 3D Perspective Tilt on Scroll
      gsap.fromTo(section,
        {
          rotateX: i % 2 === 0 ? -5 : 5,
          z: -100,
          perspective: 1000
        },
        {
          rotateX: 0,
          z: 0,
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "top 20%",
            scrub: 1.5
          }
        }
      );

      // Liquid Content Reveal with Stagger
      const contentElements = section.querySelectorAll('.phase-content > *');
      if (contentElements.length > 0) {
        gsap.fromTo(contentElements,
          {
            opacity: 0,
            y: 50,
            filter: 'blur(10px)'
          },
          {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            stagger: 0.15,
            duration: 1.2,
            ease: "power3.out",
            scrollTrigger: {
              trigger: section,
              start: "top 80%",
              toggleActions: "play none none reverse",
            }
          }
        );
      }

      // Giant Numbers (Subtle Drifting)
      const bgNum = section.querySelector('.bg-number');
      if (bgNum) {
        gsap.to(bgNum, {
          y: -150,
          x: i % 2 === 0 ? 30 : -30,
          scale: 1.1,
          opacity: 0.03,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "bottom top",
            scrub: true
          }
        });
      }
    });
  }, { dependencies: [expertIdentity, jobs] });

  useEffect(() => {
    const checkState = async () => {
      try {
        const [auth, kb] = await Promise.all([
          mcpService.checkAuth(),
          mcpService.getExpertProfile().catch(() => ({ skills: [], daily_stats: { count: 0 } }))
        ])
        
        const isAuth = !!auth.authenticated
        
        // If authenticated, stop polling and sync profile
        if (isAuth) {
          syncProfile()
          // NEW: Load existing discovered jobs so they don't disappear on F5
          mcpService.fetchCRMJobs().then(allJobs => {
            const discovered = allJobs.filter(j => j.status === 'discovered').slice(0, 10)
            if (discovered.length > 0) setJobs(discovered)
          })
          return true // signal to stop polling
        }
        return false
      } catch (err) {
        console.error('Handshake failed:', err)
        return false
      }
    }
    
    checkState()
    
    // Set up polling interval if not authenticated
    const interval = setInterval(async () => {
      const isDone = await checkState()
      if (isDone) clearInterval(interval)
    }, 5000)
    
    return () => clearInterval(interval)
  }, [])

  // BUG 3 FIX: syncProfile only handles LinkedIn — KB already loaded by fetchProfile
  const syncProfile = async () => {
    // Run silently in the background without blocking the UI
    try {
      const userData = await mcpService.fetchProfile()
      setProfile(userData)
      if (userData.skills && userData.skills.length > 0) {
        setSearchConfig(prev => ({
          ...prev,
          skills: [...new Set([...(prev.skills || []), ...(userData.skills || [])])],
          keywords: userData.headline || prev.keywords
        }))
      }
      setShowLoginPrompt(false)
    } catch (error) {
      console.error('LinkedIn Neural Bridge handshake delayed or timed out:', error)
    }
  }



  const handleAcceptJob = async (jobId: string) => {
    const job = [...liveJobs, ...dbJobs, ...jobs].find(j => (j.linkedin_id || j.id) === jobId);
    try {
      await mcpService.updateJobStatus(jobId, 'interested', job);
      setLiveJobs(prev => prev.filter(j => (j.linkedin_id || j.id) !== jobId));
      setDbJobs(prev => prev.filter(j => (j.linkedin_id || j.id) !== jobId));
      setJobs(prev => prev.filter(j => (j.linkedin_id || j.id) !== jobId));
      addLog('Opportunity accepted and moved to Application Pipeline.', 'kpi');
    } catch (e) {
      console.error('Failed to accept job:', e);
    }
  };

  const handleRejectJob = async (jobId: string) => {
    const job = [...liveJobs, ...dbJobs, ...jobs].find(j => (j.linkedin_id || j.id) === jobId);
    try {
      await mcpService.updateJobStatus(jobId, 'ignored', job);
      setLiveJobs(prev => prev.filter(j => (j.linkedin_id || j.id) !== jobId));
      setDbJobs(prev => prev.filter(j => (j.linkedin_id || j.id) !== jobId));
      setJobs(prev => prev.filter(j => (j.linkedin_id || j.id) !== jobId));
      addLog('Opportunity archived in database.', 'info');
    } catch (e) {
      console.error('Failed to reject job:', e);
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSearchConfig(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skillToRemove)
    }))
  };

  const handleLogin = async () => {
    console.log('[UI] Neural Handshake button clicked');
    addLog('Initiating Neural Handshake Protocol...', 'sync');
    setIsSyncing(true);
    try {
      const result = await mcpService.triggerLogin();
      addLog(`Handshake Signal: ${result.message}`, 'kpi');
      console.log('[UI] Handshake result:', result);
    } catch (error: any) {
      console.error('[UI] Handshake failed:', error);
      addLog(`Handshake failed: ${error.message}`, 'critical');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetEngine = async () => {
    if (!confirm('This will forcefully terminate and restart the LinkedIn Neural Engine. Use only if the hunt is hanging. Proceed?')) return
    
    setIsResetting(true)
    setMeshState('thinking')
    addLog('Forced Neural Reset initiated...', 'critical')
    
    try {
      await mcpService.resetEngine()
      addLog('Neural Engine Reset requested. Clearing cache and restarting scraper...', 'system')
      
      // Wait for handshake
      let attempts = 0
      const checkInterval = setInterval(async () => {
        attempts++
        try {
          const auth = await mcpService.checkAuth()
          if (auth.authenticated) {
            clearInterval(checkInterval)
            setIsResetting(false)
            setMeshState('success')
            addLog('Neural Engine back online. Synapses restored.', 'kpi')
            syncProfile()
          }
          if (attempts > 12) { // 60 seconds
            clearInterval(checkInterval)
            setIsResetting(false)
            setMeshState('idle')
            addLog('Neural Engine handshake timed out. Check terminal logs.', 'critical')
          }
        } catch (e) {
          console.error('Polling error:', e)
        }
      }, 5000)
    } catch (error: any) {
      setIsResetting(false)
      setMeshState('idle')
      addLog(`Reset failed: ${error.message}`, 'error')
    }
  }

  const handleSaveGroqKey = async () => {
    if (!groqKey) return
    try {
      await mcpService.saveGroqKey(groqKey)
      localStorage.setItem('skillhunter_groq', groqKey)
      alert('Expert AI Engine Initialized! Groq Key saved.')
    } catch (error: any) {
      alert(`Groq Error: ${error.message}`)
    }
  }

  const toggleDebug = async () => {
    const nextMode = !debugMode
    setDebugMode(nextMode)
    await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ debug: nextMode })
    })
    alert(`Debug Mode ${nextMode ? 'ON (Browser Visible)' : 'OFF'}. The engine has been restarted.`)
  }

  useEffect(() => {
    if (!loading) return

    const messages = [
      "Deploying Intelligence Scout (MCP Core)...",
      "Authenticating via Secure Cookie Protocol...",
      "Bypassing LinkedIn gatekeeper protocols...",
      "Scraping high-value project DNA...",
      "Executing Deep Match Analysis...",
      "Sifting through market noise...",
      "Finalizing Neural Persistence Sync..."
    ]

    let idx = 0
    const interval = setInterval(() => {
      idx = (idx + 1) % messages.length
      setSearchMessage(messages[idx])
    }, 2000)

    return () => clearInterval(interval)
  }, [loading])

  // ── AUTOPILOT HANDLERS ────────────────────────────────────

  const fetchAutopilotStatus = async () => {
    try {
      const status = await mcpService.getAutopilotStatus()
      setAutopilot(status)
      // Only set inputs on initial load to prevent overwriting user edits during polling
      if (!autopilot) {
        setAutopilotLimitInput(status.dailyLimit)
        setAutopilotIntervalInput(status.intervalHours)
        setAutopilotPagesInput(status.maxPages || 1)
      }
    } catch (e) {
      // Backend offline — fail silently
    }
  }

  useEffect(() => {
    fetchAutopilotStatus()
    // Poll every 60s to keep stats fresh when autopilot is running
    const timer = setInterval(fetchAutopilotStatus, 60000)
    return () => clearInterval(timer)
  }, [])

  const handleToggleAutopilot = async () => {
    setAutopilotLoading(true)
    try {
      const result = await mcpService.toggleAutopilot()
      setAutopilot(prev => prev ? { ...prev, enabled: result.enabled } : null)
      addLog(result.enabled
        ? 'Neural Autopilot ACTIVATED. Background hunt engaged.'
        : 'Neural Autopilot DEACTIVATED. Hunt suspended.',
        result.enabled ? 'kpi' : 'info')
      await fetchAutopilotStatus() // Refresh full stats
    } catch (e) {
      console.error('Autopilot toggle failed:', e)
    } finally {
      setAutopilotLoading(false)
    }
  }

  const fetchMemories = async () => {
    try {
      const data = await mcpService.getMemories()
      setMemories(data)
    } catch (e) {
      console.error('Failed to fetch memories:', e)
    }
  }

  useEffect(() => {
    if (expertIdentity) {
      fetchMemories()
    }
  }, [expertIdentity])

  const handleDeepMapping = async () => {
    setIsDeepMapping(true)
    setMeshState('thinking')
    addLog('Deep Identity Mapping sequence initiated (Gemini 2.0)...', 'critical')
    try {
      await mcpService.deepMap()
      addLog('Neural Synthesis background process started.', 'sync')
      // Poll for update
      triggerProfilePolling(180000)
    } catch (e) {
      addLog(`Mapping failed: ${e.message}`, 'critical')
    } finally {
      setIsDeepMapping(false)
      setMeshState('idle')
    }
  }

  const handleSaveAutopilotConfig = async () => {
    try {
      await mcpService.setAutopilotConfig(autopilotLimitInput, autopilotIntervalInput, autopilotPagesInput)
      await fetchAutopilotStatus()
      addLog(`Autopilot reconfigured: ${autopilotLimitInput} hunts/day, every ${autopilotIntervalInput}h, depth ${autopilotPagesInput}p`, 'sync')
      alert(`Neural Pulse Updated: ${autopilotLimitInput} Hunts/Day, Every ${autopilotIntervalInput}h (Min 3h for safety).`)
    } catch (e) {
      console.error('Autopilot config failed:', e)
      alert('Failed to update pulse settings.')
    }
  }

  const handleInitVision = async () => {
    setIsVisionInitializing(true)
    addLog('Initializing Neural Vision Engine (Stagehand)...', 'sync')
    try {
      await mcpService.initVision()
      setIsVisionActive(true)
      addLog('Neural Vision Engine ONLINE. Intent-based navigation active.', 'kpi')
    } catch (e: any) {
      addLog(`Vision Init Failed: ${e.message}`, 'critical')
    } finally {
      setIsVisionInitializing(false)
    }
  }

  const handleVisionHunt = async () => {
    setIsVisionHunting(true)
    addLog(`Neural Vision: Engaging autonomous hunt for "${searchConfig.keywords}"...`, 'sync')
    try {
      const result = await mcpService.visionHunt(searchConfig.keywords, searchConfig.location)
      if (result.success) {
        addLog(`Neural Vision: Extraction successful! Node found: ${result.job.title} @ ${result.job.company}`, 'kpi')
        // We could refresh jobs list here
        fetchInitialJobs()
      }
    } catch (e: any) {
      addLog(`Vision Hunt Failed: ${e.message}`, 'critical')
    } finally {
      setIsVisionHunting(false)
    }
  }

  const handleSearch = async (config: SearchConfigType) => {
    setLoading(true)
    setMeshState('thinking')
    try {
      const finalConfig = { ...config };
      if (!finalConfig.keywords.trim() && finalConfig.skills.length > 0) {
        finalConfig.keywords = finalConfig.skills.slice(0, 3).join(' ');
        setSearchConfig(finalConfig);
      }

      setShowAuthError(false)
      const data = await mcpService.searchJobs(finalConfig)
      
      // Clean deduplication and strict ranking by CV match score
      const cleanResults = deduplicateJobs(data).sort((a: any, b: any) =>
        (b.matchScore || b.match_score || 0) - (a.matchScore || a.match_score || 0)
      );
      setLiveJobs(cleanResults as any);
      setJobs(cleanResults as any);
      setJobTab('live');
      setLiveJobCount(cleanResults.length);
      addLog(`Hunt Complete: ${cleanResults.length} authentic roles found and ranked by affinity with your CV profile.`, 'kpi');
      // Silently refresh PostgreSQL DB so the saved bank gets updated
      fetchInitialJobs(true);
      setSearchConfig(finalConfig)
      setMeshState('success')
      setTimeout(() => setMeshState('idle'), 3000)
    } catch (err: any) {
      console.error('Search failed:', err)
      if (err.message?.includes('LINKEDIN_SESSION_EXPIRED') || err.message?.includes('401')) {
          setShowAuthError(true)
          addLog('LinkedIn Session Expired. Please login again.', 'critical')
          setMeshState('idle')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSelectRole = (query: string, skills?: string[]) => {
    const updatedConfig: SearchConfigType = {
      ...searchConfig,
      keywords: query,
      skills: skills && skills.length > 0 ? [...new Set([...searchConfig.skills, ...skills])] : searchConfig.skills
    };
    setSearchConfig(updatedConfig);
    addLog(`🎯 Target role selected: "${query}". Filters loaded. Click "START HUNT" to scan live LinkedIn matching opportunities.`, 'sync');

    // Smooth scroll to search bar so user can review and click when ready
    const searchBar = document.getElementById('search-config-container');
    if (searchBar) {
      searchBar.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleImportJob = async (jobData: { url?: string; description?: string; title?: string; company?: string; location?: string }) => {
    setLoading(true);
    setMeshState('thinking');
    try {
      const data = await mcpService.importJob(jobData);
      if (data && data.job) {
        const imported = data.job;
        const newJob: Job = {
          id: imported.id,
          linkedin_id: imported.linkedin_id || imported.id,
          title: imported.title,
          company: imported.company,
          location: imported.location || 'Remote',
          description: imported.description,
          linkedin_url: imported.url || '#',
          type: 'Full-time',
          match_score: imported.matchScore || 90,
          status: 'discovered'
        };

        setJobs(prev => [newJob, ...prev]);
        setLiveJobCount(prev => prev + 1);
        addLog(`Job imported successfully: ${imported.title} @ ${imported.company}`, 'kpi');
        setMeshState('success');
      }
    } catch (err: any) {
      console.error('Import job failed:', err);
      addLog(`Failed to import job: ${err.message}`, 'critical');
      setMeshState('idle');
    } finally {
      setLoading(false);
    }
  };

  const simulateNodes = () => {
    const demoJobs: Job[] = [
      { id: 'demo1', title: 'Neural Solutions Architect', company: 'DeepMind Ecosystem', location: 'Remote / Neural Node', salary: '€180k - €240k', match_score: 98, description: 'Leading the integration of agentic workflows in multi-tenant SaaS environments.', linkedin_url: '#', type: 'Full-time', linkedin_id: 'd1', status: 'discovered' },
      { id: 'demo2', title: 'Senior AI Engineer (n8n & Python)', company: 'Bio-Neon Labs', location: 'Global Vicinity', salary: '€120k - €160k', match_score: 84, description: 'Orchestrating complex automation pipelines using n8n and high-performance Python nodes.', linkedin_url: '#', type: 'Contract', linkedin_id: 'd2', status: 'discovered' },
      { id: 'demo3', title: 'Creative Technologist', company: 'CyberDynamics', location: 'Remote', salary: 'Competitive', match_score: 72, description: 'Fusing strategic design with complex automation to create measurable ROI.', linkedin_url: '#', type: 'Full-time', linkedin_id: 'd3', status: 'discovered' },
      { id: 'demo4', title: 'Product Strategist', company: 'Global Flow', location: 'Remote', salary: 'N/A', match_score: 58, description: 'Defining the roadmap for next-gen intelligent CRMs and business systems.', linkedin_url: '#', type: 'Full-time', linkedin_id: 'd4', status: 'discovered' }
    ]
    setJobs(demoJobs)
    setMeshState('success')
    setTimeout(() => setMeshState('idle'), 2000)
  }

  const currentTabJobs = useMemo(() => {
    return jobTab === 'live' ? liveJobs : dbJobs;
  }, [jobTab, liveJobs, dbJobs]);

  const displayedJobs = useMemo(() => {
    const deduped = deduplicateJobs(currentTabJobs);
    if (matchFilter === 'high') {
      return deduped.filter(j => (j.matchScore || j.match_score || 0) >= 75);
    }
    return deduped;
  }, [currentTabJobs, matchFilter]);

  const highMatchCount = useMemo(() => {
    return deduplicateJobs(currentTabJobs).filter(j => (j.matchScore || j.match_score || 0) >= 75).length;
  }, [currentTabJobs]);

  const { settings, toggleNoise, toggleParticles } = useVisualSettings()

  if (appInitializing) {
    return <NeuralLoader loading={true} message="Initializing Neural Core" subMessage="Synchronizing 2026 Knowledge Mesh" />
  }

  return (
    <Layout
      aiState={meshState}
      skills={searchConfig?.skills || []}
      categories={groupedTraits}
    >
      <NeuralCursor />
      <div className={`relative min-h-screen p-4 md:px-8 pt-4 pb-32 ${settings.showNoise ? 'glass-noise' : ''}`}>
        <div className="w-full max-w-[1850px] mx-auto space-y-6">

          <div className="flex justify-end items-center gap-4 opacity-40 hover:opacity-100 transition-opacity">
            <button
              onClick={toggleDebug}
              className={`text-[9px] font-black px-3 py-1.5 rounded-lg border tracking-widest transition-all uppercase ${debugMode ? 'bg-bio-neon-green/20 border-bio-neon-green text-bio-neon-green shadow-bio-neon' : 'border-white/10 text-white/20 hover:border-white/30'}`}
              title="Alternar Modo Visível do Navegador (Headless vs Visível)"
            >
              Debug: {debugMode ? 'On' : 'Off'}
            </button>
          </div>
          {/* RADAR EDITORIAL HERO HEADER */}
          <EditorialHeader
            badgeIcon={<Sparkles size={14} className="text-green-400" />}
            badgeText="AUTONOMOUS RECRUITING AI"
            badgeColor="emerald"
            titleMain="OPPORTUNITY"
            titleSecondary="RADAR"
            subtitle="Predictive screening and autonomous AI engine calibrated directly against your professional identity and CV."
            actions={
              <div className="flex flex-wrap items-center gap-3">
                <span className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-wider border transition-all ${
                  newJobsAlert
                    ? 'bg-green-500/20 border-green-500 text-green-400 animate-pulse shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                    : 'bg-white/5 border-white/10 text-white/70'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${newJobsAlert ? 'bg-green-400 shadow-[0_0_10px_#22c55e]' : 'bg-green-400'}`} />
                  {jobs.length} Opportunities Detected
                </span>

                <button
                  onClick={() => fetchInitialJobs(false)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-xs font-black uppercase tracking-wider text-white/60 hover:text-white hover:border-white/20 transition-all cursor-pointer"
                  title="Sync with local database"
                >
                  <RefreshCcw size={13} /> Sync DB
                </button>
              </div>
            }
          />

          {/* MAIN RADAR FEED */}
          <div className="space-y-8 pt-2 relative z-10">
            <div className="space-y-6">
                {/* 🚨 SESSION EXPIRED ALERT */}
                <AnimatePresence>
                  {showAuthError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className="relative overflow-hidden"
                    >
                      <div className="p-6 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
                            <Shield className="text-red-500 animate-pulse" size={24} />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-black text-red-500 uppercase tracking-widest">LinkedIn Session Expired</h4>
                            <p className="text-xs text-white/50">Your session token is invalid. Please login to LinkedIn in the browser to refresh.</p>
                          </div>
                        </div>
                        <Button 
                          onClick={() => window.open('https://www.linkedin.com', '_blank')}
                          className="bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30 rounded-xl px-6"
                        >
                          Refresh Session
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 🚀 COMPACT COMMAND BAR: Neural Bridge + Autopilot + Vision + Memory + Profile */}
                <div className="p-4 px-6 rounded-[2rem] bg-gradient-to-r from-white/[0.04] to-white/[0.01] border border-white/10 backdrop-blur-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                      <Link2 size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-xs tracking-wider uppercase text-white">LinkedIn Neural Bridge</h3>
                        <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_#22c55e]" title="Active Connection via Session" />
                      </div>
                      <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-0.5">Authenticated Session · MCP Engine Active</p>
                    </div>
                  </div>

                  {/* Compact Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Compact Autopilot Button */}
                    <div className="relative flex items-center">
                      <button
                        onClick={handleToggleAutopilot}
                        disabled={autopilotLoading}
                        className={`px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                          autopilot?.enabled
                            ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.3)] animate-pulse'
                            : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'
                        }`}
                        title={autopilot?.enabled ? 'Autopilot active in background. Click to disable.' : 'Autopilot idle. Click to enable.'}
                      >
                        <Zap size={12} className={autopilot?.enabled ? 'fill-blue-400' : ''} />
                        <span>{autopilot?.enabled ? `Autopilot: ON (${autopilot.todayCount || 0}/${autopilot.dailyLimit || 3})` : 'Autopilot: OFF'}</span>
                      </button>
                      <button
                        onClick={() => setIsAutopilotModalOpen(true)}
                        className="p-2 ml-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white cursor-pointer"
                        title="Configure Autopilot limits and intervals"
                      >
                        <Settings size={12} />
                      </button>
                    </div>

                    {/* Compact Vision Engine Button */}
                    <button
                      onClick={isVisionActive ? handleVisionHunt : handleInitVision}
                      disabled={isVisionInitializing || isVisionHunting}
                      className={`px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                        isVisionActive
                          ? 'bg-green-500/20 border-green-500 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                          : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'
                      }`}
                      title="Autonomous computer vision with anti-bot human-like simulation"
                    >
                      <Eye size={13} className={isVisionActive ? 'text-green-400' : ''} />
                      <span>{isVisionInitializing ? 'Connecting...' : isVisionHunting ? 'Hunting...' : isVisionActive ? 'Vision: Active' : 'Vision Engine'}</span>
                    </button>

                    {/* Neural Memory */}
                    <button
                      onClick={() => setShowNeuralGraph(!showNeuralGraph)}
                      className={`px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer ${
                        showNeuralGraph
                          ? 'bg-green-500/20 border-green-500 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                          : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                      }`}
                      title="Explore knowledge graph and RAG memories"
                    >
                      <Sparkles size={12} /> Memory
                    </button>

                    {/* Sync CV Profile */}
                    <button
                      onClick={() => fetchProfile()}
                      className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-green-400 hover:border-green-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Reload CV skills and profile attributes"
                    >
                      <RefreshCcw size={12} /> Sync CV
                    </button>
                  </div>
                </div>

                {/* Autopilot Configuration Modal */}
                {isAutopilotModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="w-full max-w-md bg-bio-void border border-bio-neon-blue/40 rounded-3xl p-6 shadow-2xl space-y-5 relative">
                      <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                          <Zap size={18} className="text-bio-neon-blue" />
                          <h3 className="text-sm font-black text-white uppercase tracking-wider">Autopilot Configuration</h3>
                        </div>
                        <button onClick={() => setIsAutopilotModalOpen(false)} className="text-white/40 hover:text-white text-xs font-bold p-1">✕</button>
                      </div>

                      <div className="space-y-4 text-xs">
                        <div>
                          <label className="text-white/70 font-bold block mb-1">Daily Search Limit</label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={autopilotLimitInput}
                            onChange={(e) => setAutopilotLimitInput(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-bold"
                          />
                          <span className="text-[10px] text-white/40 mt-1 block">Recommended: 3 to 5 searches/day to protect your account.</span>
                        </div>

                        <div>
                          <label className="text-white/70 font-bold block mb-1">Execution Interval (Hours)</label>
                          <input
                            type="number"
                            min={1}
                            max={24}
                            value={autopilotIntervalInput}
                            onChange={(e) => setAutopilotIntervalInput(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-bold"
                          />
                        </div>

                        <div>
                          <label className="text-white/70 font-bold block mb-1">Result Pages Per Run</label>
                          <input
                            type="number"
                            min={1}
                            max={3}
                            value={autopilotPagesInput}
                            onChange={(e) => setAutopilotPagesInput(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-bold"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                        <button
                          onClick={() => setIsAutopilotModalOpen(false)}
                          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            await handleSaveAutopilotConfig();
                            setIsAutopilotModalOpen(false);
                          }}
                          className="px-5 py-2 rounded-xl bg-bio-neon-blue text-black text-xs font-black uppercase tracking-wider shadow-bio-neon hover:scale-105 transition-all"
                        >
                          Save Settings
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Neural Memory Graph View (If Active) */}
              <AnimatePresence>
                {showNeuralGraph && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pt-4"
                  >
                    <NeuralMemoryGraph />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Discovery Feed */}
              <div className="space-y-8 pt-4 relative z-30 overflow-visible">
                {/* Real-time AI Market Intelligence & Role Recommendations */}
                <MarketIntelligence onSelectRole={handleSelectRole} activeQuery={searchConfig.keywords} />

                {/* Horizontal Filter Bar */}
                <SearchConfig onSearch={handleSearch} onImportJob={handleImportJob} loading={loading} initialConfig={searchConfig} />

                <main className="space-y-6">
                  {/* ── TWO MASTER TABS: CURRENT SEARCH vs SAVED JOBS (DB) ── */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2 bg-white/[0.02] p-1.5 rounded-full border border-white/5">
                      <button
                        onClick={() => setJobTab('live')}
                        className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                          jobTab === 'live'
                            ? 'bg-white text-black shadow-xl shadow-white/5'
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Zap size={13} className={jobTab === 'live' ? 'fill-black' : ''} />
                        <span>Current Search</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${jobTab === 'live' ? 'bg-black/10 text-black' : 'bg-white/10 text-white/60'}`}>
                          {liveJobs.length}
                        </span>
                      </button>

                      <button
                        onClick={() => setJobTab('db')}
                        className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                          jobTab === 'db'
                            ? 'bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Database size={13} />
                        <span>Saved Jobs (DB)</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${jobTab === 'db' ? 'bg-black/20 text-black' : 'bg-white/10 text-white/60'}`}>
                          {dbJobs.length}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLogin}
                        disabled={isSyncing}
                        className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30 text-[10px] font-black uppercase tracking-widest h-9 px-4 rounded-full flex items-center gap-1.5 cursor-pointer"
                        title="Verify LinkedIn session authentication"
                      >
                        <Zap size={11} />
                        Neural Handshake
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetEngine}
                        disabled={isSyncing}
                        className="bg-white/5 hover:bg-white/10 text-white/40 border-white/10 text-[9px] font-black uppercase tracking-widest h-8 px-3 rounded-xl flex items-center gap-1.5"
                        title="Reset browser engine if unresponsive"
                      >
                        <RotateCcw size={11} className={isSyncing ? 'animate-spin' : ''} />
                        Reset Mesh
                      </Button>
                      <button
                        onClick={() => fetchInitialJobs(false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-bio-neon-green hover:border-bio-neon-green/30 transition-all h-8 cursor-pointer"
                        title="Reload all opportunities from local PostgreSQL"
                      >
                        <RefreshCcw size={11} />
                        Sync DB
                      </button>
                    </div>
                  </div>

                  {/* Filter Sub-Bar & Quota Guard Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.03] p-3 rounded-2xl border border-white/5 backdrop-blur-xl">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setMatchFilter('all')}
                        className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                          matchFilter === 'all'
                            ? 'bg-bio-neon-green/20 text-bio-neon-green border border-bio-neon-green/40 shadow-bio-neon'
                            : 'bg-white/5 text-white/50 hover:text-white border border-white/5'
                        }`}
                      >
                        <Briefcase size={12} /> All Opportunities ({currentTabJobs.length})
                      </button>
                      <button
                        onClick={() => setMatchFilter('high')}
                        className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                          matchFilter === 'high'
                            ? 'bg-bio-neon-blue/20 text-bio-neon-blue border border-bio-neon-blue/40 shadow-[0_0_15px_rgba(0,180,255,0.3)]'
                            : 'bg-white/5 text-white/50 hover:text-white border border-white/5'
                        }`}
                      >
                        <Sparkles size={12} /> Best Matches ≥75% ({highMatchCount})
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-white/40 font-bold uppercase tracking-widest">
                      <Shield size={13} className="text-bio-neon-green" />
                      <span>{jobTab === 'live' ? '⚡ Real-time Discovery Feed' : '🗄️ Local PostgreSQL · Latest Indexed on Top'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {loading ? (
                      <div className="py-24 flex flex-col items-center justify-center space-y-8">
                        <div className="relative">
                          <div className="w-20 h-20 border-2 border-bio-neon-green/20 border-t-bio-neon-green rounded-full animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center text-bio-neon-green font-black text-[10px]">AI</div>
                        </div>
                        <p className="text-[11px] font-black text-bio-neon-green uppercase tracking-[0.5em] animate-pulse">{searchMessage}</p>
                      </div>
                    ) : displayedJobs.length > 0 ? (
                      <AnimatePresence>
                        {displayedJobs.map((job, i) => (
                          <motion.div
                            key={(job.linkedin_id || job.id || i).toString()}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                          >
                            <JobCard
                              job={job}
                              userSkills={knowledgeBase?.skills || searchConfig.skills}
                              onAccept={() => handleAcceptJob(job.linkedin_id || job.id)}
                              onReject={() => handleRejectJob(job.linkedin_id || job.id)}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    ) : currentTabJobs.length > 0 ? (
                      <div className="py-12 text-center space-y-3 bg-white/[0.02] border border-white/5 rounded-3xl p-8">
                        <p className="text-sm font-bold text-white/60">No opportunities reach ≥75% match score in this view.</p>
                        <button
                          onClick={() => setMatchFilter('all')}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                        >
                          View All {currentTabJobs.length} Opportunities
                        </button>
                      </div>
                    ) : jobTab === 'live' ? (
                      <div className="py-16 px-6 text-center bio-glass rounded-3xl border border-white/5 space-y-5">
                        <div className="w-14 h-14 rounded-2xl bg-bio-neon-blue/10 border border-bio-neon-blue/20 flex items-center justify-center mx-auto text-bio-neon-blue">
                          <Zap size={24} />
                        </div>
                        <div className="max-w-md mx-auto space-y-1.5">
                          <h3 className="text-base font-black text-white uppercase tracking-wider">No Active Search Running</h3>
                          <p className="text-xs text-white/50 leading-relaxed">
                            Configure your search criteria above and click <span className="text-bio-neon-green font-bold">"HUNT JOBS"</span> to scout opportunities in real-time, or explore your local saved database.
                          </p>
                        </div>
                        {dbJobs.length > 0 ? (
                          <button
                            onClick={() => setJobTab('db')}
                            className="px-6 py-2.5 rounded-xl bg-bio-neon-green text-black font-black text-[10px] uppercase tracking-wider shadow-bio-neon hover:scale-105 transition-all cursor-pointer inline-flex items-center gap-2"
                          >
                            <Database size={13} /> View Saved Jobs Database ({dbJobs.length} Roles)
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSearch(searchConfig)}
                            className="px-6 py-2.5 rounded-xl bg-bio-neon-green text-black font-black text-[10px] uppercase tracking-wider shadow-bio-neon hover:scale-105 transition-all cursor-pointer inline-flex items-center gap-2"
                          >
                            <Search size={13} /> Start First Discovery Run
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="py-16 px-6 text-center bio-glass rounded-3xl border border-white/5 space-y-5">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/40">
                          <Database size={24} />
                        </div>
                        <div className="max-w-md mx-auto space-y-1.5">
                          <h3 className="text-base font-black text-white uppercase tracking-wider">Local Database Empty</h3>
                          <p className="text-xs text-white/50 leading-relaxed">
                            No opportunities indexed yet in local PostgreSQL. Run a search above to discover and archive jobs automatically.
                          </p>
                        </div>
                        <button
                          onClick={() => setJobTab('live')}
                          className="px-6 py-2.5 rounded-xl bg-bio-neon-blue text-black font-black text-[10px] uppercase tracking-wider shadow-[0_0_20px_rgba(0,180,255,0.4)] hover:scale-105 transition-all cursor-pointer inline-flex items-center gap-2"
                        >
                          <Zap size={13} /> Switch to Live Search
                        </button>
                      </div>
                    )}
                  </div>
                </main>
              </div>
            </div>
        </div>
      </div>

      {/* Neural Vault Modal */}
      <AnimatePresence>
        {showVault && (
          <DigitalTwinVault
            identity={expertIdentity}
            onClose={() => setShowVault(false)}
          />
        )}
      </AnimatePresence>

      {/* Dynamic Loaders */}
      <NeuralVaultLoader loading={isLearning} isSuccess={vaultSuccess} />
      <NeuralLoader loading={loading && jobs.length === 0} message="Syncing Neural Matrix" subMessage={searchMessage} />

      {/* Auth Gate */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-[100] bg-[#020205]/95 backdrop-blur-xl flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md w-full bio-glass p-12 rounded-[4rem] text-center space-y-10 border-white/5 shadow-2xl"
          >
            <div className="w-24 h-24 bg-bio-neon-green/10 rounded-[2rem] flex items-center justify-center mx-auto text-bio-neon-green shadow-bio-neon border border-bio-neon-green/20">
              <Fingerprint size={48} />
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">Auth Required</h2>
              <p className="text-sm text-white/40 leading-relaxed font-medium">Your LinkedIn Neural Bridge is currently disconnected. Establish secure handshake to continue.</p>
            </div>
            <button onClick={handleLogin} className="w-full bg-bio-neon-green text-bio-void py-5 rounded-2xl font-black text-xs uppercase tracking-[0.4em] shadow-bio-neon hover:scale-[1.02] transition-transform">Authorize Connection</button>
          </motion.div>
        </div>
      )}

      {/* Background Learning Indicator */}
      <AnimatePresence>
        {isBackgroundLearning && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 right-8 z-[60] bio-glass p-4 rounded-2xl border-bio-neon-blue/30 flex items-center gap-4 shadow-bio-neon"
          >
            <div className="w-8 h-8 rounded-lg bg-bio-neon-blue/10 flex items-center justify-center">
              <BrainCircuit size={16} className="text-bio-neon-blue animate-pulse" />
            </div>
            <div>
              <p className="text-[9px] font-black text-white uppercase tracking-widest">Neural Learning</p>
              <p className="text-[7px] font-bold text-bio-neon-blue uppercase tracking-[0.2em]">{ingestionProgress || 'Processing Collective DNA...'}</p>
            </div>
            <div className="ml-4 w-12 h-1 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="w-full h-full bg-bio-neon-blue shadow-bio-neon"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🤖 FLOATING AUTOPILOT WIDGET (Bottom-Left) */}
      <AnimatePresence>
        {(autopilot?.enabled && !isPanelVisible) && (
          <motion.div
            initial={{ opacity: 0, x: -50, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -50, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => autopilotPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="fixed bottom-10 left-10 z-[100] bio-glass p-4 pr-6 rounded-2xl border border-bio-neon-blue/20 flex items-center gap-4 cursor-pointer group shadow-[0_0_40px_rgba(0,0,0,0.5)]"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-bio-neon-blue/10 flex items-center justify-center text-bio-neon-blue border border-bio-neon-blue/20">
                <Zap size={20} className="animate-pulse" />
              </div>
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-bio-neon-blue rounded-full animate-ping" />
            </div>
            
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white">Neural Autopilot</span>
                <span className="w-1 h-1 rounded-full bg-bio-neon-blue animate-pulse" />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[6px] font-black text-white/20 uppercase">Hunts</span>
                  <span className="text-[10px] font-black text-white italic">{autopilot.todayCount}/{autopilot.dailyLimit}</span>
                </div>
                <div className="w-[1px] h-4 bg-white/5" />
                <div className="flex flex-col">
                  <span className="text-[6px] font-black text-white/20 uppercase">Next Sync</span>
                  <span className="text-[10px] font-black text-bio-neon-blue italic">
                    {autopilot.nextRunAt ? new Date(autopilot.nextRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Subtle progress ring background */}
            <div className="absolute inset-0 bg-gradient-to-r from-bio-neon-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  )
}
