import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react'
import { mcpService, type Job } from '../lib/mcp-service'
import { Badge } from './ui/badge'
import { 
  Send, MessageSquare, Trophy, XCircle, Building, 
  ChevronRight, Zap, ExternalLink, Clock, Loader2, 
  RefreshCcw, DollarSign, FileText, ChevronDown, 
  Save, CheckCircle2, X, Target, 
  AlertTriangle, BrainCircuit, Sparkles, Shield, 
  Swords, Lightbulb, Copy, Check, Cpu, MapPin, Trash2, Search
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  DndContext, closestCorners, KeyboardSensor, 
  PointerSensor, useSensor, useSensors, 
  DragOverlay, defaultDropAnimationSideEffects, 
  useDroppable, type DragStartEvent, 
  type DragOverEvent, type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, 
  verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AmbientBackground, BentoCard, EditorialHeader, PillButton } from './ui/design-system'
import Layout from './Layout'
import JobCard from './JobCard'
import LottieLoader from './LottieLoader'
import Sparkline from './Sparkline'
import NeuralLoader from './NeuralLoader'
import { useDragSound } from '../hooks/useDragSound'

const STAGES = [
  { id: 'discovered', label: 'Discovered', icon: Search, color: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10', glow: '' },
  { id: 'interested', label: 'Shortlist', icon: Zap, color: 'text-bio-neon-blue', bg: 'bg-bio-neon-blue/10', border: 'border-bio-neon-blue/20', glow: 'shadow-bio-cyan' },
  { id: 'applied', label: 'Applied', icon: Send, color: 'text-bio-neon-purple', bg: 'bg-bio-neon-purple/10', border: 'border-bio-neon-purple/20', glow: 'shadow-bio-neon' },
  { id: 'interviewing', label: 'Interviews', icon: MessageSquare, color: 'text-bio-neon-cyan', bg: 'bg-bio-neon-cyan/10', border: 'border-bio-neon-cyan/20', glow: 'shadow-bio-cyan' },
  { id: 'offered', label: 'Offers', icon: Trophy, color: 'text-bio-neon-green', bg: 'bg-bio-neon-green/10', border: 'border-bio-neon-green/20', glow: 'shadow-bio-neon' },
  { id: 'rejected', label: 'Archived', icon: XCircle, color: 'text-white/20', bg: 'bg-white/5', border: 'border-white/10', glow: '' },
]

const SortableCard = memo(function SortableCard({ 
  job, 
  userSkills = [], 
  onOpenProfile, 
  onDelete, 
  onUpdateBudget, 
  updatingId, 
  isNewBadge 
}: { 
  job: Job; 
  userSkills?: string[]; 
  onOpenProfile: () => void; 
  onDelete?: () => void; 
  onUpdateBudget?: (id: string, budget: string) => void; 
  updatingId: string | null; 
  isNewBadge: boolean 
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [prepareDelete, setPrepareDelete] = useState(false);
  const [deleteReady, setDeleteReady] = useState(false);

  // ... (keep useEffect for delete logic)

  // Unified Weighted score logic (same as JobCard)
  const displayScore = useMemo(() => {
    const raw = job.match_score ?? job.matchScore ?? job.score;
    let officialScore = typeof raw === 'number' ? raw : (typeof raw === 'string' ? parseFloat(raw) : null);
    
    // Normalize if match_score is stored as decimal 0.0 - 1.0 (e.g. 0.85 -> 85%)
    if (officialScore !== null && officialScore > 0 && officialScore <= 1.0) {
      officialScore = Math.round(officialScore * 100);
    }

    if (officialScore !== null && !isNaN(officialScore) && officialScore > 0) {
      return Math.min(100, Math.max(0, Math.round(officialScore)));
    }
    
    if (!userSkills || userSkills.length === 0) return 75; 
    
    try {
        const matches = typeof job.matched_skills === 'string' ? JSON.parse(job.matched_skills) : (job.matched_skills || []);
        const gaps = typeof job.skills_gaps === 'string' ? JSON.parse(job.skills_gaps as string) : (job.skills_gaps || []);
        
        const CORE_WEIGHT = 2.5;
        const TOOL_WEIGHT = 0.5;
        const NORMAL_WEIGHT = 1.0;
        const coreTech = ["react", "node", "typescript", "ai", "agents", "automation", "python", "three.js", "next.js", "supabase"];

        let totalWeightedMatches = 0;
        let totalPotentialWeight = 0;

        matches.forEach((skill: string) => {
            const s = skill.toLowerCase();
            const weight = coreTech.some(ct => s.includes(ct)) ? CORE_WEIGHT : NORMAL_WEIGHT;
            totalWeightedMatches += weight;
            totalPotentialWeight += weight;
        });

        gaps.forEach((skill: string) => {
            const s = skill.toLowerCase();
            const weight = coreTech.some(ct => s.includes(ct)) ? CORE_WEIGHT : TOOL_WEIGHT;
            totalPotentialWeight += weight;
        });

        const scoreBase = Math.max(5, totalPotentialWeight);
        const calculated = Math.round((totalWeightedMatches / scoreBase) * 100);
        const criticalMatchCount = matches.filter((s: string) => coreTech.some(ct => s.toLowerCase().includes(ct))).length;
        
        const finalScore = Math.min(100, Math.max(calculated, criticalMatchCount >= 2 ? 65 : (criticalMatchCount >= 1 ? 45 : 0)));
        return isNaN(finalScore) ? 75 : finalScore;
    } catch { return 75 }
  }, [job.match_score, job.matchScore, job.score, job.matched_skills, job.skills_gaps, userSkills]);

  // Radius = 16 => Circumference = 2 * PI * 16 ≈ 100.53
  const CIRCUMFERENCE = 100.53;
  const dashOffset = CIRCUMFERENCE - (CIRCUMFERENCE * displayScore) / 100;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: job.linkedin_id || job.id,
    data: { job }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  const currentStage = useMemo(() => STAGES.find(s => s.id === job.status) || STAGES[0], [job.status])

  const matches = useMemo(() => {
    try { return typeof job.matched_skills === 'string' ? JSON.parse(job.matched_skills) : (job.matched_skills || []) } catch { return [] }
  }, [job.matched_skills])

  // 2026: Hot lead detection
  const isHot = job.isFresh || !!job.deep_intelligence_pack;
  const isVeryHot = job.isFresh && !!job.deep_intelligence_pack;

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* ... (Status Glows) ... */}
      
      <motion.div
        layout
        layoutId={`card-${job.linkedin_id || job.id}`}
        onClick={onOpenProfile}
        {...attributes}
        {...listeners}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`p-5 rounded-[2rem] bg-gradient-to-r from-white/[0.04] to-white/[0.01] border backdrop-blur-xl space-y-4 relative overflow-hidden cursor-pointer z-10 transition-all duration-300 shadow-lg hover:shadow-2xl hover:-translate-y-0.5 ${
          job.status === 'offered' 
            ? 'bg-green-500/10 border-green-500/40 shadow-[0_0_20px_rgba(34,197,94,0.1)]' 
            : job.status === 'rejected'
            ? 'bg-white/[0.01] border-white/5 opacity-50 grayscale'
            : isHot
            ? isVeryHot
              ? 'border-green-500/30'
              : 'border-blue-500/30'
            : 'border-white/10 hover:border-white/20'
        } ${prepareDelete ? 'border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : ''}`}
      >
        <div className="flex items-start justify-between gap-4 pr-2 pl-2">
          <div className="space-y-2">
            <h4 className="font-black text-white text-sm leading-tight uppercase tracking-tight group-hover:text-bio-neon-green transition-colors line-clamp-2">
              {job.title}
            </h4>
            <div className="flex items-center gap-2 text-[9px] text-white/30 font-black uppercase tracking-[0.2em]">
              <Building size={10} className="text-bio-neon-blue" />
              {job.company}
            </div>
          </div>

          {/* Neural Match Ring */}
          <div className="shrink-0 relative w-10 h-10 flex items-center justify-center">
             <svg className="w-full h-full -rotate-90 scale-125">
                <circle cx="20" cy="20" r="16" className="stroke-white/5 fill-none" strokeWidth="2" />
                <motion.circle 
                    cx="20" cy="20" r="16" 
                    style={{ 
                      stroke: displayScore >= 90 ? '#00ff80' : 
                              displayScore >= 75 ? '#00d4ff' : 
                              displayScore >= 60 ? '#facc15' : 
                              displayScore >= 40 ? '#f97316' : '#ef4444' 
                    }}
                    className="fill-none" 
                    strokeWidth="2" 
                    strokeDasharray={CIRCUMFERENCE}
                    initial={{ strokeDashoffset: CIRCUMFERENCE }}
                    animate={{ strokeDashoffset: dashOffset }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                />
             </svg>
             <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[7px] font-black text-white leading-none">{displayScore}%</span>
                <span 
                  style={{ 
                    color: displayScore >= 90 ? '#00ff80' : 
                           displayScore >= 75 ? '#00d4ff' : 
                           displayScore >= 60 ? '#facc15' : 
                           displayScore >= 40 ? '#f97316' : '#ef4444' 
                  }}
                  className="text-[5px] font-black uppercase tracking-tighter mt-0.5"
                >
                  DNA
                </span>
             </div>
          </div>
        </div>

        {/* Preparing Delete Indicator */}
        {prepareDelete && (
          <div className="absolute inset-0 bg-red-500/[0.02] flex flex-col items-center justify-center gap-2 z-20 pointer-events-none">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '60%' }}
              transition={{ duration: 2.5, ease: "linear" }}
              className="h-0.5 bg-red-500/40 rounded-full"
            />
            <span className="text-[7px] font-black text-red-500/40 uppercase tracking-[0.4em] animate-pulse">Preparing Deletion Protocol...</span>
          </div>
        )}

        {/* Delete Trigger - Only shows after 3s hover */}
        <AnimatePresence>
          {deleteReady && (
            <motion.button 
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Permanently purge this operational node?')) {
                  if (onDelete) onDelete();
                }
              }}
              className="absolute bottom-4 right-4 p-3 rounded-2xl bg-red-500 text-white shadow-lg shadow-red-500/40 z-30 group/delete border border-red-400/20"
            >
              <Trash2 size={16} className="group-hover/delete:rotate-12 transition-transform" />
            </motion.button>
          )}
        </AnimatePresence>

        {matches.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
             {matches.slice(0, 3).map((skill: string, i: number) => (
                <div key={i} className="text-[8px] font-black uppercase text-bio-neon-green bg-bio-neon-green/10 px-2 py-0.5 rounded-full border border-bio-neon-green/20">
                  {skill}
                </div>
             ))}
          </div>
        )}

        <div className="pt-2 flex items-center justify-between text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">
            <div className="flex items-center gap-1.5">
                <Clock size={10} />
                {new Date(job.updated_at || "").toLocaleDateString()}
            </div>
            <div className="flex items-center gap-1 text-bio-neon-blue">
                Neural Focus <ChevronRight size={10} />
            </div>
        </div>

        {updatingId === (job.linkedin_id || job.id) && (
          <div className="absolute inset-0 bg-bio-void/80 backdrop-blur-sm flex items-center justify-center z-20">
            <Loader2 size={20} className="text-bio-neon-green animate-spin" />
          </div>
        )}
      </motion.div>
    </div>
  );
});


const Lane = memo(function Lane({ stage, jobs, updatingId, onOpenProfile, onDeleteNode, onUpdateBudget, clearedBadges, userSkills }: { stage: typeof STAGES[0]; jobs: Job[]; updatingId: string | null; onOpenProfile: (job: Job) => void; onDeleteNode: (id: string) => void; onUpdateBudget: (id: string, budget: string) => void; clearedBadges: string[]; userSkills: string[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const Icon = stage.icon;
  // Magnetic intensity: stronger glow the more jobs near this column
  const magnetStrength = isOver ? 1 : 0;
  const laneRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (isOver) {
      gsap.to(laneRef.current, {
        backgroundColor: 'rgba(0, 255, 157, 0.05)',
        duration: 0.3,
        ease: 'power2.out'
      });
      // Add a subtle bounce effect to the icon
      gsap.fromTo(`.lane-icon-${stage.id}`, 
        { y: 0 }, 
        { y: -10, duration: 0.4, repeat: -1, yoyo: true, ease: 'sine.inOut' }
      );
    } else {
      gsap.to(laneRef.current, {
        backgroundColor: 'transparent',
        duration: 0.5,
        ease: 'power2.in'
      });
      gsap.to(`.lane-icon-${stage.id}`, { y: 0, duration: 0.3 });
    }
  }, [isOver]);

  return (
    <motion.div
      ref={(el) => {
        setNodeRef(el);
        (laneRef as any).current = el;
      }}
      className={`flex-1 min-w-[320px] flex flex-col h-full border-r border-white/5 last:border-r-0 relative group/lane transition-all duration-500 ${isOver ? 'z-20' : 'z-10'}`}
    >
      {/* Ambient Stage Glow */}
      <div className={`absolute top-0 left-0 right-0 h-64 bg-gradient-to-b ${stage.bg.replace('/10', '/5')} to-transparent opacity-30 pointer-events-none`} />
      
      {/* Drop zone breathing glow */}
      {isOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.4, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="absolute inset-0 border-2 border-bio-neon-green/30 rounded-none pointer-events-none z-0"
        />
      )}
      <div className={`flex-none flex items-center justify-between px-6 py-5 border-b border-white/5 bg-[#050505]/60 backdrop-blur-xl z-10`}>
        <div className="flex items-center gap-3.5">
          <motion.div 
            whileHover={{ rotate: 15, scale: 1.05 }}
            className={`p-2 rounded-full ${stage.bg} border ${stage.border} transition-all duration-300 lane-icon-${stage.id}`}
          >
            <Icon className={stage.color} size={16} />
          </motion.div>
          <div className="flex flex-col">
            <span className="font-black text-[11px] uppercase tracking-[0.2em] text-white group-hover/lane:text-green-400 transition-colors">{stage.label}</span>
            <span className="text-[8px] font-black text-white/30 uppercase tracking-widest mt-0.5">Pipeline Stage</span>
          </div>
        </div>
        <div className="px-3 py-1 rounded-full bg-white/5 text-white/60 text-[10px] font-black border border-white/10 uppercase tracking-widest">
          {jobs.length}
        </div>
      </div>

      <SortableContext id={stage.id} items={jobs.map(j => j.linkedin_id || j.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar" data-lenis-prevent>
          <AnimatePresence mode="popLayout">
            {jobs.map((job) => {
              const jobId = job.linkedin_id || job.id;
              const isNew = !clearedBadges.includes(jobId) && 
                            job.updated_at && 
                            (Date.now() - new Date(job.updated_at).getTime() < 48 * 3600 * 1000);

              return (
                <SortableCard 
                  key={job.id} 
                  job={job} 
                  userSkills={userSkills}
                  onOpenProfile={() => onOpenProfile(job)} 
                  onDelete={() => onDeleteNode(jobId)}
                  onUpdateBudget={onUpdateBudget}
                  updatingId={updatingId} 
                  isNewBadge={!!isNew}
                />
              )
            })}
          </AnimatePresence>
          {jobs.length === 0 && (
            <div className="h-52 rounded-4xl border border-dashed border-white/5 flex flex-col items-center justify-center gap-2 group/empty hover:border-white/10 transition-all">
              <LottieLoader type="empty" size={64} />
              <p className="text-[9px] font-black text-white/10 group-hover/empty:text-white/20 uppercase tracking-[0.4em] transition-colors">Empty Protocol</p>
            </div>
          )}
        </div>
      </SortableContext>
    </motion.div>
  );
});

function TrashZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'trash-zone' });
  
  return (
    <motion.div
      ref={setNodeRef}
      animate={{ 
        height: isOver ? 120 : 80,
        backgroundColor: isOver ? 'rgba(255, 0, 85, 0.1)' : 'rgba(255, 0, 85, 0.02)',
        borderColor: isOver ? 'rgba(255, 0, 85, 0.4)' : 'rgba(255, 0, 85, 0.1)'
      }}
      className="flex-none w-full border-t border-dashed flex items-center justify-center gap-6 transition-all overflow-hidden relative group/trash"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
         {isOver && (
            <motion.div 
              animate={{ 
                background: [
                  'radial-gradient(circle at 50% 50%, rgba(255, 0, 85, 0.15) 0%, transparent 70%)',
                  'radial-gradient(circle at 50% 50%, rgba(255, 0, 85, 0.25) 0%, transparent 70%)',
                  'radial-gradient(circle at 50% 50%, rgba(255, 0, 85, 0.15) 0%, transparent 70%)'
                ]
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0"
            />
         )}
      </div>

      <motion.div 
        animate={{ 
          scale: isOver ? 1.2 : 1,
          rotate: isOver ? [0, -10, 10, 0] : 0
        }}
        transition={{ rotate: { repeat: Infinity, duration: 0.5 } }}
        className={`p-3 rounded-2xl ${isOver ? 'bg-red-500 text-white shadow-lg shadow-red-500/40' : 'bg-red-500/10 text-red-500/40'} border border-red-500/20 transition-all z-10`}
      >
        <Trash2 size={isOver ? 28 : 20} />
      </motion.div>

      <div className="flex flex-col z-10">
        <span className={`text-[11px] font-black uppercase tracking-[0.5em] transition-all ${isOver ? 'text-red-500 drop-shadow-bio-neon' : 'text-red-500/30'}`}>
          {isOver ? 'RELEASE TO PURGE NODE' : 'DRAG HERE TO DEACTIVATE'}
        </span>
        <div className="flex items-center gap-2 mt-1">
           <div className={`h-[1px] transition-all duration-500 ${isOver ? 'w-32 bg-red-500' : 'w-12 bg-red-500/20'}`} />
           <span className="text-[7px] font-black text-red-500/40 uppercase tracking-widest">Protocol 0xDEADBEEF</span>
           <div className={`h-[1px] transition-all duration-500 ${isOver ? 'w-32 bg-red-500' : 'w-12 bg-red-500/20'}`} />
        </div>
      </div>
    </motion.div>
  );
}

export default function Pipeline() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isOverTrash, setIsOverTrash] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [coachMessage, setCoachMessage] = useState<{ title: string; text: string; type: 'success' | 'info' | 'learn' } | null>(null)

  useEffect(() => {
    if (coachMessage) {
      const timer = setTimeout(() => setCoachMessage(null), 7000);
      return () => clearTimeout(timer);
    }
  }, [coachMessage]);
  const [clearedBadges, setClearedBadges] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('skillhunter_cleared_badges') || '[]');
    } catch {
      return [];
    }
  });

  const clearBadge = useCallback((id: string) => {
    setClearedBadges(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem('skillhunter_cleared_badges', JSON.stringify(next));
      return next;
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const { playPickup, playDrop } = useDragSound()

  const loadJobs = async () => {
    setLoading(true)
    try {
      const [jobsData, profileData] = await Promise.all([
        mcpService.fetchCRMJobs(),
        mcpService.getExpertProfile().catch(() => null)
      ])
      setJobs(jobsData)
      setProfile(profileData)
    } catch (error) {
      console.error('Failed to load CRM jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadJobs() }, [])

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    playPickup()
    window.dispatchEvent(new CustomEvent('kanban:dragstart'))
  }, [playPickup])

  const onDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    window.dispatchEvent(new CustomEvent('kanban:dragend'))
    playDrop()
    setIsOverTrash(false)
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string
    
    // Check if dropped in trash zone
    if (overId === 'trash-zone') {
      if (confirm('Are you sure you want to permanently delete this node?')) {
        handleRemoveNode(activeId);
      }
      return;
    }

    // Neural Shockwave Effect
    const laneEl = document.querySelector(`[id="${overId}"]`) || document.getElementById(overId);
    if (laneEl) {
      const ripple = document.createElement('div');
      ripple.className = 'absolute inset-0 bg-bio-neon-blue/10 animate-ping rounded-full pointer-events-none z-50';
      laneEl.appendChild(ripple);
      setTimeout(() => ripple.remove(), 1000);
    }

    const activeJob = jobs.find(j => (j.linkedin_id || j.id) === activeId)
    if (!activeJob) return

    const overStage = STAGES.find(s => s.id === overId)
    const overJob = jobs.find(j => (j.linkedin_id || j.id) === overId)
    const finalStageId = overStage ? overStage.id : (overJob ? overJob.status : activeJob.status)

    if (finalStageId && finalStageId !== activeJob.status) {
        setUpdatingId(activeId)
        clearBadge(activeId) // Clear the NEW badge if it was moved to a new category
        setJobs(prev => prev.map(j => (j.linkedin_id === activeId || j.id === activeId) ? { ...j, status: finalStageId } : j))

        if (finalStageId === 'interviewing') {
            setCoachMessage({
                title: '🎉 Interview Scheduled!',
                text: `You advanced to interview stage at ${activeJob.company || 'the target company'}! The autonomous AI agent logged this success pattern to calibrate and prioritize similar high-yield roles.`,
                type: 'success'
            });
        } else if (finalStageId === 'offered') {
            setCoachMessage({
                title: '🏆 Job Offer Received!',
                text: `Outstanding! Formal offer received from ${activeJob.company || 'the target company'}. Profile alignment and interview strategy achieved a 100% win rate!`,
                type: 'success'
            });
        } else if (finalStageId === 'applied') {
            setCoachMessage({
                title: '🚀 Application Submitted',
                text: `Application tracked for ${activeJob.company || 'the company'}. Your autonomous agent will continue tracking market updates and opportunities.`,
                type: 'info'
            });
        } else if (finalStageId === 'rejected') {
            setCoachMessage({
                title: '💡 Intelligent Recalibration',
                text: `Opportunity archived. The AI agent ingested the role criteria and updated negative constraints to prevent irrelevant matches moving forward.`,
                type: 'learn'
            });
        }

        try {
            await mcpService.updateJobStatus(activeId, finalStageId, activeJob)
        } catch (error) {
            loadJobs()
        } finally {
            setUpdatingId(null)
        }
    }
  }, [playDrop, jobs, clearBadge])

  const filteredJobs = useMemo(() => {
    if (!searchTerm) return jobs;
    const term = searchTerm.toLowerCase();
    return jobs.filter(j => 
      j.title.toLowerCase().includes(term) || 
      j.company.toLowerCase().includes(term) ||
      (j.location && j.location.toLowerCase().includes(term))
    );
  }, [jobs, searchTerm]);

  const onDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    setIsOverTrash(over?.id === 'trash-zone');
  }, []);

  const activeDragJob = useMemo(() => filteredJobs.find(j => (j.linkedin_id || j.id) === activeId), [activeId, filteredJobs])

  const handleRemoveNode = async (linkedinId: string) => {
    try {
        setLoading(true);
        await mcpService.deleteJob(linkedinId);
        setJobs(prev => prev.filter(j => (j.linkedin_id || j.id) !== linkedinId));
    } catch (e) {
        console.error('Failed to delete node:', e);
    } finally {
        setLoading(false);
    }
  };

  const handleUpdateBudget = async (linkedinId: string, budget: string) => {
    const job = jobs.find(j => (j.linkedin_id || j.id) === linkedinId);
    if (!job) return;
    
    setUpdatingId(linkedinId);
    setJobs(prev => prev.map(j => (j.linkedin_id === linkedinId || j.id === linkedinId) ? { ...j, budget } : j));
    
    try {
        await mcpService.updateJobStatus(linkedinId, job.status || 'interested', { ...job, budget });
    } catch (error) {
        console.error('Failed to update budget:', error);
        loadJobs();
    } finally {
        setUpdatingId(null);
    }
  };

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-[#050505]">
        {/* COMPACT FULLSCREEN PIPELINE BAR */}
        <div className="flex-none px-6 py-3.5 border-b border-white/5 bg-[#050505]/80 backdrop-blur-2xl flex items-center justify-between gap-4 z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20 text-green-400">
              <Cpu size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-xs uppercase tracking-[0.2em] text-white">Application Pipeline</h2>
                <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-[9px] font-black uppercase tracking-widest">
                  {jobs.length} Opportunities
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative group/search">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 text-white/30 group-hover/search:text-green-400 transition-colors" size={14} />
                <input 
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search jobs, roles, or companies..."
                  className="bg-white/5 border border-white/10 rounded-full pl-10 pr-6 py-1.5 text-xs font-semibold text-white placeholder:text-white/30 focus:border-green-500/50 focus:bg-white/10 outline-none transition-all w-52 lg:w-72"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3.5 text-white/30 hover:text-white cursor-pointer">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={loadJobs}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
            >
              <RefreshCcw size={12} className={loading ? 'animate-spin text-green-400' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* 🌟 AI Career Coach Empathetic Feedback Toast Banner */}
        <AnimatePresence>
          {coachMessage && (
            <motion.div
              initial={{ opacity: 0, y: -15, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -15, height: 0 }}
              className="px-8 py-3.5 bg-gradient-to-r from-bio-void via-white/[0.04] to-bio-void border-b border-bio-neon-blue/30 flex items-center justify-between gap-4 z-30"
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-xl border ${
                  coachMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                  coachMessage.type === 'learn' ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' :
                  'bg-blue-500/10 border-blue-500/30 text-blue-300'
                }`}>
                  <BrainCircuit size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">{coachMessage.title}</h4>
                  <p className="text-[12px] text-white/80 font-medium leading-relaxed">{coachMessage.text}</p>
                </div>
              </div>
              <button 
                onClick={() => setCoachMessage(null)}
                className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all shrink-0"
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Neural Stats Bar */}
        <div className="flex-none px-8 py-4 bg-bio-void/40 border-b border-white/5 flex items-center gap-12 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-3 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-bio-neon-green shadow-bio-neon animate-pulse" />
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Pipeline Health: <span className="text-bio-neon-green">Optimum</span></span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Target size={14} className="text-bio-neon-blue" />
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Active Nodes: <span className="text-white">{filteredJobs.length}</span></span>
                <Sparkline data={filteredJobs.slice(-7).map((_, i) => ({ v: i + 1 }))} color="#00d2ff" height={24} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Sparkles size={14} className="text-bio-neon-cyan" />
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">AI Readiness: <span className="text-bio-neon-cyan">{Math.round((jobs.filter(j => j.deep_intelligence_pack).length / (jobs.length || 1)) * 100)}%</span></span>
                <Sparkline data={[{v:10},{v:25},{v:18},{v:40},{v:35},{v:60},{v:Math.round((jobs.filter(j => j.deep_intelligence_pack).length / (jobs.length || 1)) * 100)}]} color="#00f2ff" height={24} />
            </div>
            <div className="flex items-center gap-3 shrink-0">
                <Shield size={14} className="text-bio-neon-purple" />
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Neural Persistence: <span className="text-bio-neon-purple">Encrypted</span></span>
            </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
          <div className="flex-1 overflow-hidden flex min-h-0">
            <div className="flex gap-0 w-full h-full overflow-x-auto select-none custom-scrollbar" data-lenis-prevent>
              {STAGES.map((stage) => (
                <Lane 
                  key={stage.id} 
                  stage={stage} 
                  jobs={filteredJobs.filter(j => j.status === stage.id)} 
                  updatingId={updatingId} 
                  userSkills={profile?.identity?.topSkills || profile?.skills || []}
                  onOpenProfile={(job) => {
                    setSelectedJob(job);
                    clearBadge(job.linkedin_id || job.id); // Clear NEW badge on open
                  }} 
                  onDeleteNode={handleRemoveNode}
                  onUpdateBudget={handleUpdateBudget}
                  clearedBadges={clearedBadges}
                />
              ))}
            </div>
          </div>

          <AnimatePresence>
            {activeId && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <TrashZone />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedJob && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-6 overflow-y-auto" data-lenis-prevent>
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  onClick={() => setSelectedJob(null)}
                  className="fixed inset-0 bg-black/90 backdrop-blur-2xl" 
                />
                <div className="relative w-full max-w-5xl max-h-[90vh] my-auto z-10 flex flex-col overflow-y-auto custom-scrollbar">
                  <JobCard 
                    job={selectedJob} 
                    userSkills={profile?.identity?.topSkills || profile?.skills || []} 
                    onClose={() => setSelectedJob(null)}
                    onDelete={() => {
                      handleRemoveNode(selectedJob.linkedin_id || selectedJob.id);
                      setSelectedJob(null);
                    }}
                    onUpdateBudget={(budget) => handleUpdateBudget(selectedJob.linkedin_id || selectedJob.id, budget)}
                  />
                </div>
              </div>
            )}
          </AnimatePresence>

          <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
            {activeDragJob ? (
              <motion.div 
                animate={{ 
                  scale: isOverTrash ? 0.8 : 1.1,
                  filter: isOverTrash ? 'grayscale(1) contrast(2) brightness(2)' : 'none',
                  rotate: isOverTrash ? [0, -1, 1, 0] : 2
                }}
                transition={{ 
                  rotate: isOverTrash ? { repeat: Infinity, duration: 0.1 } : { duration: 0.2 }
                }}
                className="w-[310px] pointer-events-none"
              >
                  <div className={`relative rounded-3xl transition-all duration-300 ${isOverTrash ? 'shadow-[0_0_40px_rgba(255,0,85,0.4)]' : 'shadow-2xl shadow-black/50'}`}>
                    <SortableCard 
                      job={activeDragJob} 
                      userSkills={profile?.identity?.topSkills || profile?.skills || []}
                      onOpenProfile={() => {}} 
                      updatingId={null} 
                      isNewBadge={!clearedBadges.includes(activeDragJob.linkedin_id || activeDragJob.id)} 
                    />
                    {/* Neural Glitch Overlay when over trash */}
                    {isOverTrash && (
                      <motion.div 
                        animate={{ opacity: [0, 0.6, 0.3, 0.8, 0] }}
                        transition={{ duration: 0.15, repeat: Infinity }}
                        className="absolute inset-0 bg-red-500/30 mix-blend-overlay rounded-3xl z-50"
                      />
                    )}
                  </div>
              </motion.div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <NeuralLoader 
          loading={loading} 
          message="Neural Pipeline Active" 
          subMessage="Synchronizing CRM Nodes..." 
        />
      </div>
    </Layout>
  )
}
