import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  Sparkles, 
  RefreshCcw, 
  Compass, 
  Target, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  DollarSign, 
  Flame, 
  ShieldCheck, 
  Globe,
  Briefcase,
  Layers,
  Cpu
} from 'lucide-react';
import { mcpService } from '../lib/mcp-service';

interface RecommendedRole {
  id: string;
  category?: string;
  category_label?: string;
  title: string;
  search_query: string;
  match_score: number;
  demand_level: string;
  demand_tier: 'critical' | 'high' | 'moderate';
  reasoning: string;
  top_skills: string[];
  estimated_salary: string;
  estimated_jobs_count?: string;
  work_mode?: string;
}

interface MarketData {
  success: boolean;
  generated_date: string;
  candidate_name: string;
  candidate_title: string;
  target_location: string;
  market_summary: string;
  market_signals: string[];
  recommended_roles: RecommendedRole[];
}

interface MarketIntelligenceProps {
  onSelectRole: (query: string, skills?: string[]) => void;
  activeQuery?: string;
}

export default function MarketIntelligence({ onSelectRole, activeQuery }: MarketIntelligenceProps) {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [activeSelectedId, setActiveSelectedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const fetchMarketData = async (refresh: boolean = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const res = await mcpService.getMarketRecommendations(refresh);
      if (res && res.recommended_roles) {
        setData(res);
      }
    } catch (err) {
      console.error('[MARKET INTELLIGENCE] Error fetching data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMarketData(false);
  }, []);

  const handleApplyRole = (role: RecommendedRole) => {
    setActiveSelectedId(role.id);
    onSelectRole(role.search_query, role.top_skills);
  };

  const getTierBadge = (tier: string, label: string) => {
    if (tier === 'critical') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/15 border border-rose-500/40 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.25)]">
          <Flame size={11} className="animate-pulse text-rose-400" />
          {label}
        </span>
      );
    }
    if (tier === 'high') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-bio-neon-blue/15 border border-bio-neon-blue/40 text-bio-neon-blue shadow-[0_0_12px_rgba(59,130,246,0.25)]">
          <Zap size={11} className="text-bio-neon-blue" />
          {label}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
        <TrendingUp size={11} className="text-emerald-400" />
        {label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="w-full bio-glass rounded-2xl p-3 border border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Compass size={16} className="text-bio-neon-green animate-spin" />
          <span className="text-xs font-bold text-white/50">A calcular posições recomendadas pelo teu CV com IA...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const roles = data.recommended_roles || [];
  const filteredRoles = selectedCategory === 'all' 
    ? roles 
    : roles.filter(r => r.category === selectedCategory);

  const categories = [
    { id: 'all', label: 'Todos os Cargos', count: roles.length },
    { id: 'agentic', label: '🤖 Agentes & IA', count: roles.filter(r => r.category === 'agentic').length },
    { id: 'automation', label: '⚡ Automação & Python', count: roles.filter(r => r.category === 'automation').length },
    { id: 'rag', label: '🧠 RAG & Conhecimento', count: roles.filter(r => r.category === 'rag').length },
    { id: 'architecture', label: '🏛️ Arquitetura & MLOps', count: roles.filter(r => r.category === 'architecture').length },
  ].filter(c => c.id === 'all' || c.count > 0);

  return (
    <div className="w-full bio-glass rounded-2xl border border-bio-neon-blue/20 bg-gradient-to-r from-bio-void/95 via-bio-void to-black/90 shadow-[0_0_25px_rgba(0,180,255,0.05)] relative overflow-hidden transition-all">
      {/* Sleek Compact Header Bar with Direct Pill Choices */}
      <div className="p-3.5 px-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-bio-neon-blue/15 border border-bio-neon-blue/30 flex items-center justify-center">
            <Compass size={16} className="text-bio-neon-blue" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white uppercase tracking-wider">Cargos Recomendados</span>
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-bio-neon-green/20 text-bio-neon-green border border-bio-neon-green/30">
                {roles.length} Opções IA
              </span>
            </div>
          </div>
        </div>

        {/* Clickable Fast-Select Pills with Horizontal Overflow */}
        <div className="flex items-center flex-wrap gap-2 flex-1 max-w-3xl">
          {roles.slice(0, 4).map((role) => {
            const isSelected = activeSelectedId === role.id || activeQuery?.toLowerCase().includes(role.search_query.toLowerCase());
            return (
              <button
                key={role.id}
                onClick={() => handleApplyRole(role)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-bio-neon-green text-black border border-bio-neon-green shadow-bio-neon'
                    : 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 hover:border-bio-neon-blue/30'
                }`}
                title={`Clique para selecionar: ${role.title} (${role.match_score}% Match). Não dispara busca automática.`}
              >
                <span>{role.title.replace(' (CrewAI / LangGraph)', '').replace(' (LangGraph / CrewAI)', '')}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${isSelected ? 'bg-black/20 text-black' : 'bg-white/10 text-bio-neon-green'}`}>
                  {role.match_score}%
                </span>
              </button>
            );
          })}

          {roles.length > 4 && (
            <button
              onClick={() => setIsExpanded(true)}
              className="px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-bio-neon-blue/10 hover:bg-bio-neon-blue/20 text-bio-neon-blue border border-bio-neon-blue/30 transition-all cursor-pointer flex items-center gap-1"
            >
              <span>+{roles.length - 4} Mais Cargos</span>
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchMarketData(true)}
            disabled={refreshing}
            className="p-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-white/5 disabled:opacity-50"
            title="Atualizar análise de mercado com IA"
          >
            <RefreshCcw size={11} className={`${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? '...' : 'Atualizar'}
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
            title={isExpanded ? 'Ocultar detalhes de mercado' : 'Ver justificações completas de mercado'}
          >
            <span>{isExpanded ? 'Recolher' : `Ver Todos (${roles.length})`}</span>
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="p-6 space-y-6 relative z-10"
          >
            {/* Market Executive Summary & Signals */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-bio-neon-blue">
                  <Sparkles size={12} />
                  Visão Estratégica do Teu Perfil Hoje
                </div>
                <p className="text-xs text-white/80 leading-relaxed">
                  {data.market_summary}
                </p>
              </div>

              {/* Signals Pills */}
              {data.market_signals && data.market_signals.length > 0 && (
                <div className="w-full lg:w-auto flex flex-wrap lg:flex-col gap-1.5 shrink-0">
                  {data.market_signals.slice(0, 3).map((signal, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-medium text-white/70 max-w-md">
                      <ShieldCheck size={12} className="text-bio-neon-green shrink-0" />
                      <span className="truncate">{signal}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center flex-wrap gap-2 pb-1 border-b border-white/5">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedCategory === cat.id
                      ? 'bg-bio-neon-blue text-black font-black shadow-[0_0_15px_rgba(0,180,255,0.4)]'
                      : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    selectedCategory === cat.id ? 'bg-black/20 text-black' : 'bg-white/10 text-white/50'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Recommended Positions Grid */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h4 className="text-xs font-black uppercase tracking-widest text-white/60 flex items-center gap-2">
                  <Target size={13} className="text-bio-neon-green" />
                  Top Posições Recomendadas para Procurar ({filteredRoles.length})
                </h4>
                <span className="text-[10px] font-bold text-white/40">
                  Clica em <span className="text-bio-neon-green font-black">"Selecionar Cargo"</span> para preencher os filtros da busca
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredRoles.map((role) => {
                  const isSelected = activeSelectedId === role.id || activeQuery?.toLowerCase().includes(role.search_query.toLowerCase());

                  return (
                    <motion.div
                      key={role.id}
                      whileHover={{ y: -3, transition: { duration: 0.2 } }}
                      className={`relative rounded-2xl p-4.5 flex flex-col justify-between transition-all duration-300 border ${
                        isSelected
                          ? 'bg-bio-neon-green/10 border-bio-neon-green/60 shadow-[0_0_25px_rgba(0,255,136,0.18)]'
                          : 'bg-white/[0.04] hover:bg-white/[0.07] border-white/10 hover:border-bio-neon-blue/40'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          {getTierBadge(role.demand_tier, role.demand_level)}
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/10 text-bio-neon-green border border-bio-neon-green/30">
                            {role.match_score}% Match
                          </span>
                        </div>

                        {/* Title & Category */}
                        <div>
                          {role.category_label && (
                            <span className="text-[9px] font-bold text-bio-neon-blue uppercase tracking-wider block mb-1">
                              {role.category_label}
                            </span>
                          )}
                          <h5 className="text-sm font-black text-white leading-snug group-hover:text-bio-neon-green transition-colors">
                            {role.title}
                          </h5>
                          <div className="flex items-center flex-wrap gap-2.5 mt-1.5 text-[10px] text-white/50 font-medium">
                            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                              <DollarSign size={11} className="shrink-0 -mr-0.5" />
                              {role.estimated_salary}
                            </span>
                            {role.estimated_jobs_count && (
                              <span className="flex items-center gap-1 text-bio-neon-green/80 font-bold">
                                <Briefcase size={10} className="shrink-0" />
                                {role.estimated_jobs_count}
                              </span>
                            )}
                            {role.work_mode && (
                              <span className="flex items-center gap-1 text-white/40">
                                <Globe size={10} className="shrink-0" />
                                {role.work_mode}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Reasoning */}
                        <p className="text-[11px] text-white/65 leading-relaxed line-clamp-3 italic bg-black/20 p-2.5 rounded-xl border border-white/5">
                          "{role.reasoning}"
                        </p>

                        {/* Skills Chips */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {role.top_skills.slice(0, 4).map((sk, skIdx) => (
                            <span
                              key={skIdx}
                              className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-white/5 text-white/70 border border-white/10"
                            >
                              {sk}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="pt-4 mt-2 border-t border-white/5 flex flex-col gap-1.5">
                        <button
                          onClick={() => handleApplyRole(role)}
                          className={`w-full py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-bio-neon-green text-black shadow-[0_0_20px_rgba(0,255,136,0.4)]'
                              : 'bg-white/10 hover:bg-bio-neon-green hover:text-black text-white border border-white/10 hover:border-bio-neon-green'
                          }`}
                          title="Preenche a barra de pesquisa com este cargo"
                        >
                          <Target size={12} />
                          {isSelected ? '✓ Cargo Selecionado' : '🎯 Selecionar Cargo'}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
