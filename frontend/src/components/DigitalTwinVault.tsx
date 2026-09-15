import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Shield, Cpu, Zap, BrainCircuit, Globe, Briefcase, Award,
  Terminal, GraduationCap, Languages, Clock, Code2, ExternalLink,
  Star, ChevronRight, Database, Layers, User, Newspaper, Trophy
} from 'lucide-react'
import { Badge } from './ui/badge'

interface DigitalTwinVaultProps {
  identity: any
  onClose: () => void
}

const TRANSLATIONS: Record<string, any> = {
  "Alygen CRM — Agentic Market Intelligence": {
    title: "Alygen CRM — Agentic Market Intelligence",
    description: "Proprietary platform using ensemble learning and autonomous agents for B2B prospecting automation. Analyzed 1,200+ companies in seconds, identifying €500,000 in potential revenue."
  },
  "ZohoSync — Middleware de ERP/CRM Integrado": {
    title: "ZohoSync — Integrated ERP/CRM Middleware",
    description: "Robust Python middleware integration that synchronizes ERP (PHC SQL) and Zoho CRM, managing €10,000,000+ in annual transactions with 99.9% data integrity."
  },
  "Gerenciador de Presentes Avançado v4.0": {
    title: "Advanced Gift Manager v4.0",
    description: "High-performance WooCommerce plugin architecture managing referrals, visual UI tracking, and autonomous payment channels with RESTful implementations."
  },
  "Ecos de Indomitáveis — FBAUP PCD@Coimbra 2026": {
    title: "Echoes of the Indomitable — FBAUP PCD@Coimbra 2026",
    description: "Interactive installation that transforms Antero de Quental's poetry into generative visual networks. NLP transforms movement into a catalyst that reveals visual text."
  },
  "Valorant Portugal — (+10k membros)": {
    title: "Valorant Portugal — (+10k members)",
    description: "Custom automation bots, intelligent moderation, booking organization, and Webhook integrations with community management tools."
  },
  "ARKITEK — Solução de Ecosistema Digital": {
    title: "ARKITEK — Digital Ecosystem Solution",
    description: "Creation of custom systems engineering solutions to maximize efficiency, scalability, and conversion."
  },
  "HUMANITY — Projeto de Arte Digital Interativa": {
    title: "HUMANITY — Interactive Digital Art Project",
    description: "An interactive digital art project exploring the intersection of playful aesthetics and generative visual expression. The color palette changes dynamically based on country properties, contributing to the work's aesthetic diversity."
  },
  "Sistema de CRM Impulsionado por IA": {
    title: "AI-Powered CRM System",
    description: "Development of an AI-powered CRM system with 60FPS React dashboards, utilizing n8n automation and agentic Python workflows with Supabase integration."
  },
  "Desenvolvimento de Sistemas Automatizados e Inteligência Artificial": "Automated Systems and AI Development",
  "Arquitetura de Nuvem e Automação de Sistemas": "Cloud Architecture and Systems Automation",
  "Engenharia Web e Desenvolvimento Full-Stack": "Web Engineering and Full-Stack Development",
  "Automação n8n": "n8n Automation",
  "Workflows Agênticos em Python": "Agentic Workflows in Python",
  "Desenvolvimento de Modelos de Aprendizado de Máquina": "Machine Learning Model Development",
  "Integração com Supabase": "Supabase Integration",
  "60FPS React Dashboards": "60FPS React Dashboards",
  "Desenvolvimento de Arte Digital Interativa": "Interactive Digital Art Development"
};

const EXPERIENCE_TRANSLATIONS: Record<string, string> = {
  "Liderança técnica e estratégica para ARKITEK e SKUBA. Orquestração de ecosistemas de e-commerce e automação de CRM/ERP para alinhar objetivos comerciais com execução técnica.": "Technical and strategic leadership for ARKITEK and SKUBA. Orchestrated e-commerce ecosystems and CRM/ERP automation to bridge commercial goals with technical execution.",
  "Arquitetura de sistemas de alta performance e plataformas de CRM proprietárias com automação agêntica. Integração de LangChain e arquiteturas RAG para processamento inteligente de dados.": "Architected high-performance systems and proprietary CRM platforms with agentic automation. Integrated LangChain and RAG architectures for intelligent data processing."
};

const t = (text: string) => TRANSLATIONS[text] || text;

const translateProject = (proj: any) => {
    const trans = TRANSLATIONS[proj.title];
    if (trans && typeof trans === 'object') {
        return { ...proj, title: trans.title, description: trans.description };
    }
    return proj;
};

export default function DigitalTwinVault({ identity, onClose }: DigitalTwinVaultProps) {
  const [activeTab, setActiveTab] = useState('profile')

  if (!identity) return null

  const softSkillsArray: string[] = Array.isArray(identity.softSkills)
    ? identity.softSkills
    : typeof identity.softSkills === 'object' && identity.softSkills !== null
    ? Object.values(identity.softSkills).flat() as string[]
    : []

  const websites: string[] = identity.websites || []

  return (
    <div className="fixed inset-0 z-[100] bg-bio-void/95 backdrop-blur-3xl flex flex-col overflow-hidden">
      
      {/* ── TOP BAR ── */}
      <div className="flex-none flex items-center justify-between px-8 h-20 border-b border-white/5 bg-bio-void/40 backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <div className="relative w-12 h-12 rounded-2xl bg-bio-neon-green/10 flex items-center justify-center border border-bio-neon-green/20 shadow-bio-neon">
            <Shield className="text-bio-neon-green" size={20} />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-bio-neon-green border-2 border-bio-void animate-pulse" />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-[0.3em] text-white uppercase">Neural Vault <span className="text-bio-neon-green">v2026</span></h1>
            <p className="text-[9px] text-white/20 font-black tracking-[0.4em] uppercase mt-0.5">
              Identity Authenticated // Bio-Link Active
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="hidden lg:flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5">
          {SECTION_TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  isActive ? 'text-bio-void' : 'text-white/30 hover:text-white/60'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute inset-0 bg-bio-neon-green rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon size={14} />
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>

        <motion.button
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-all border border-white/10"
        >
          <X size={20} />
        </motion.button>
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar" data-lenis-prevent>
        <div className="max-w-7xl mx-auto p-8 lg:p-16 pb-32">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* ══════════════ PROFILE ══════════════ */}
              {activeTab === 'profile' && (
                <div className="space-y-20">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
                    <div className="lg:col-span-8 space-y-8">
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-bio-neon-blue/10 border border-bio-neon-blue/20 text-[10px] font-black text-bio-neon-blue tracking-widest uppercase">
                        <BrainCircuit size={14} /> Neural-Synthesized Persona
                      </div>
                      <h2 className="text-fluid-3xl font-black text-white tracking-tighter leading-none uppercase">
                        {identity.industryNiche || 'AI Solutions Architect'}
                      </h2>
                      <p className="text-fluid-base text-white/60 leading-relaxed font-medium">
                        {identity.summary}
                      </p>

                      <div className="space-y-6 pt-4">
                        <h4 className="text-[10px] font-black tracking-[0.4em] text-white/20 uppercase flex items-center gap-3">
                          <Code2 size={14} className="text-bio-neon-green" /> Core Neural Matrix
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {identity.topSkills?.map((s: string, i: number) => (
                            <span key={i} className="px-5 py-2 text-[10px] font-black text-bio-neon-green uppercase tracking-widest rounded-2xl border border-bio-neon-green/20 bg-bio-neon-green/5 hover:bg-bio-neon-green/10 transition-colors">
                              {t(s)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h4 className="text-[10px] font-black tracking-[0.4em] text-white/20 uppercase flex items-center gap-3">
                          <Zap size={14} className="text-bio-neon-purple" /> Cognitive Soft Skills
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {softSkillsArray.map((s: string, i: number) => (
                            <span key={i} className="px-4 py-1.5 rounded-xl bg-white/5 text-white/40 border border-white/5 uppercase font-black text-[9px] tracking-widest">
                              {t(s)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-4 space-y-6">
                      <div className="bio-glass p-8 rounded-4xl border-white/5 space-y-6">
                        <h4 className="text-[10px] font-black tracking-[0.3em] text-white/20 uppercase">DNA Metadata</h4>
                        {[
                          { label: 'Experience Cycle', value: '13+ Cycles' },
                          { label: 'Neural Projects', value: identity.keyProjects?.length || 0 },
                          { label: 'Validations', value: identity.certifications?.length || 0 },
                          { label: 'Exhibitions', value: identity.exhibitions?.length || 0 },
                          { label: 'Hard-coded Skills', value: identity.topSkills?.length || 0 },
                        ].map((stat, i) => (
                          <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                            <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">{stat.label}</span>
                            <span className="text-xs font-black text-bio-neon-blue">{stat.value}</span>
                          </div>
                        ))}
                      </div>

                      <div className="bio-glass p-8 rounded-4xl border-white/5 space-y-4">
                        <h4 className="text-[10px] font-black tracking-[0.3em] text-white/20 uppercase flex items-center gap-3">
                          <Terminal size={14} className="text-bio-neon-purple" /> Logic Philosophy
                        </h4>
                        <p className="text-[11px] text-white/40 leading-relaxed font-medium italic">
                          "{identity.techPhilosophy}"
                        </p>
                      </div>

                      <div className="bg-bio-neon-green/5 rounded-4xl p-6 border border-bio-neon-green/10 space-y-4">
                        <div className="flex items-center gap-3 text-[10px] font-black text-bio-neon-green uppercase tracking-widest">
                          <Cpu size={14} className="animate-pulse" /> Neural Bridge Status
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: '100%' }}
                                transition={{ duration: 2, delay: 0.5 }}
                                className="h-full bg-bio-neon-green shadow-bio-neon" 
                            />
                          </div>
                          <span className="text-[10px] text-bio-neon-green font-black">SYNCED</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ══════════════ PROJECTS ══════════════ */}
              {activeTab === 'projects' && (
                <div className="space-y-12">
                  <div className="flex items-end justify-between border-b border-white/5 pb-8">
                    <div>
                      <h3 className="text-fluid-2xl font-black text-white tracking-tighter uppercase">Neural Project Archive</h3>
                      <p className="text-[10px] text-white/30 uppercase font-black tracking-[0.3em] mt-2">Verified Industrial Evidence</p>
                    </div>
                    <span className="text-6xl font-black text-white/5 tabular-nums tracking-tighter">{identity.keyProjects?.length || 0}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {identity.keyProjects?.map((p: any, i: number) => {
                      const tp = translateProject(p);
                      return (
                        <motion.div
                          key={i}
                          whileHover={{ y: -8 }}
                          className="bio-glass p-8 rounded-4xl border-white/5 hover:border-bio-neon-green/20 transition-all flex flex-col group relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-bio-neon-green/5 blur-[60px] group-hover:bg-bio-neon-green/10 transition-colors" />
                          
                          <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-bio-neon-green/10 flex items-center justify-center border border-bio-neon-green/20">
                              <Cpu size={20} className="text-bio-neon-green" />
                            </div>
                            <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.3em]">
                              BLOCK_{String(i + 1).padStart(2, '0')}
                            </span>
                          </div>
                          <h4 className="text-lg font-black text-white group-hover:text-bio-neon-green transition-colors mb-4 leading-tight uppercase tracking-tight">
                            {tp.title}
                          </h4>
                          <p className="text-[11px] text-white/40 leading-relaxed flex-grow font-medium">
                            {tp.description}
                          </p>
                          <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap gap-1.5">
                            {p.tech?.split(',').map((t: string, ti: number) => (
                              <span
                                key={ti}
                                className="text-[8px] font-black text-bio-neon-blue/60 uppercase tracking-widest bg-bio-neon-blue/5 border border-bio-neon-blue/10 px-2.5 py-1 rounded-lg"
                              >
                                {t.trim()}
                              </span>
                            ))}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ══════════════ CAREER ══════════════ */}
              {activeTab === 'career' && (
                <div className="space-y-12">
                  <div className="flex items-end justify-between border-b border-white/5 pb-8">
                    <div>
                      <h3 className="text-fluid-2xl font-black text-white tracking-tighter uppercase">Career Timeline</h3>
                      <p className="text-[10px] text-white/30 uppercase font-black tracking-[0.3em] mt-2">Professional Execution Sequence</p>
                    </div>
                    <Clock className="text-white/5" size={64} />
                  </div>

                  <div className="relative">
                    {!identity.experience || identity.experience.length === 0 ? (
                      <div className="py-20 flex flex-col items-center justify-center text-center space-y-6 bg-white/[0.02] rounded-[3rem] border border-white/5 border-dashed">
                        <Clock className="text-white/5" size={48} />
                        <div className="space-y-2">
                           <p className="text-xs font-black text-white/20 uppercase tracking-[0.3em]">No Career Nodes Found</p>
                           <p className="text-[9px] text-white/10 uppercase tracking-widest">Run 'Ingest Narrative' to synthesize professional timeline</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-bio-neon-blue/40 via-white/5 to-transparent" />
                        <div className="space-y-12">
                          {identity.experience?.filter((job: any) => {
                            const allowedYears = ["2020-2026", "2010-2026"];
                            return allowedYears.includes(job.year);
                          }).map((exp: any, i: number) => (
                            <div key={i} className="relative pl-16">
                              <div className="absolute left-0 top-1 w-12 h-12 rounded-2xl bg-bio-neon-blue/10 border border-bio-neon-blue/20 flex items-center justify-center shadow-bio-cyan">
                                <Briefcase size={20} className="text-bio-neon-blue" />
                              </div>
                              <div className="bio-glass p-8 rounded-4xl border-white/5 hover:border-bio-neon-blue/20 transition-all">
                                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                                  <div>
                                    <h4 className="text-lg font-black text-white uppercase tracking-tight">{t(exp.role)}</h4>
                                    <p className="text-xs text-bio-neon-blue font-black uppercase tracking-widest mt-1">{exp.company}</p>
                                  </div>
                                  <span className="text-[10px] font-black text-white/30 bg-white/5 px-4 py-1.5 rounded-full border border-white/5 uppercase tracking-widest">
                                    {exp.year}
                                  </span>
                                </div>
                                <p className="text-[11px] text-white/40 leading-relaxed font-medium">{EXPERIENCE_TRANSLATIONS[exp.description] || exp.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ══════════════ CERTIFICATIONS ══════════════ */}
              {activeTab === 'certs' && (
                <div className="space-y-12">
                  <div className="flex items-end justify-between border-b border-white/5 pb-8">
                    <div>
                      <h3 className="text-fluid-2xl font-black text-white tracking-tighter uppercase">Validation Matrix</h3>
                      <p className="text-[10px] text-white/30 uppercase font-black tracking-[0.3em] mt-2">External Cognitive Proofs</p>
                    </div>
                    <Award className="text-white/5" size={64} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {identity.certifications?.map((c: any, i: number) => (
                      <motion.div 
                        key={i} 
                        whileHover={{ x: 10 }}
                        className="group flex items-center justify-between p-8 rounded-3xl bio-glass border-white/5 hover:border-bio-neon-purple/20 hover:bg-bio-neon-purple/5 transition-all"
                      >
                        <div className="flex items-center gap-6">
                          <div className="p-4 bg-bio-neon-purple/10 rounded-2xl border border-bio-neon-purple/20 group-hover:bg-bio-neon-purple/20 transition-all shadow-bio-neon">
                            <Shield className="text-bio-neon-purple" size={24} />
                          </div>
                          <div>
                            <div className="text-sm font-black text-white uppercase tracking-tight group-hover:text-bio-neon-purple transition-colors">{c.name}</div>
                            <div className="text-[9px] text-white/30 uppercase font-black tracking-[0.2em] mt-2 flex items-center gap-2">
                              <ChevronRight size={12} className="text-bio-neon-purple" />
                              {c.issuer}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="flex-none p-6 border-t border-white/5 bg-bio-void/60 backdrop-blur-xl flex items-center justify-between px-10">
        <div className="flex items-center gap-4">
          <div className="w-2.5 h-2.5 rounded-full bg-bio-neon-green shadow-bio-neon animate-pulse" />
          <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Neural Core Active // Identity Synced</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-[10px] font-black text-white/10 uppercase tracking-[0.3em]">
          <span className="flex items-center gap-2">Match: <span className="text-bio-neon-green">100%</span></span>
          <span className="flex items-center gap-2">Knowledge: <span className="text-bio-neon-blue">Hybrid</span></span>
          <span>Last Sync: {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  )
}

const SECTION_TABS = [
  { id: 'profile', label: 'DNA CORE', icon: User },
  { id: 'projects', label: 'STRATEGY', icon: Briefcase },
  { id: 'career', label: 'CAREER', icon: Clock },
  { id: 'certs', label: 'NEURAL AURA', icon: Shield },
]
