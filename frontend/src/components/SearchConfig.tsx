import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, SlidersVertical, ChevronDown, ChevronUp, Globe, Home, Building2, Zap, Loader2, Link2, PlusCircle, X, FileText, Sparkles, UserCheck } from 'lucide-react';
import { mcpService } from '../lib/mcp-service';

interface SearchConfigProps {
  onSearch: (config: SearchConfig) => void;
  onImportJob?: (jobData: { url?: string; description?: string; title?: string; company?: string; location?: string }) => void;
  loading?: boolean;
  initialConfig?: SearchConfig;
}

export interface SearchConfig {
  keywords: string;
  location: string;
  experience: string[];
  skills: string[];
  jobType: string[];
  remote: boolean;
  workMode: 'remote' | 'hybrid' | 'onsite' | 'any';
  maxPages: number;
  resultsLimit: number;
  maxDays: number;
}

export default function SearchConfig({ onSearch, onImportJob, loading = false, initialConfig }: SearchConfigProps) {
  const [config, setConfig] = useState<SearchConfig>(initialConfig || {
    keywords: 'AI Systems & Automation Engineer',
    location: 'Portugal',
    experience: ['Senior'],
    skills: [],
    jobType: ['Full-time'],
    remote: true,
    workMode: 'remote',
    maxPages: 1,
    resultsLimit: 10,
    maxDays: 15
  });

  useEffect(() => {
    if (initialConfig) setConfig(prev => ({ ...prev, ...initialConfig }));
  }, [initialConfig]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importText, setImportText] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [importCompany, setImportCompany] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [syncingCv, setSyncingCv] = useState(false);
  const [cvSynced, setCvSynced] = useState(false);

  const handleSyncWithCv = async () => {
    try {
      setSyncingCv(true);
      const res = await mcpService.fetchNeuralCV();
      if (res && res.profile) {
        const p = res.profile;
        const targetTitle = p.personal_info?.title || p.title || 'AI Systems & Automation Engineer';
        const targetLocation = p.personal_info?.location || p.location || 'Portugal';
        const rawSkills = p.hard_skills || [];
        const skillsList = Array.isArray(rawSkills)
          ? rawSkills
          : (typeof rawSkills === 'object' ? Object.values(rawSkills).flat() : []);

        setConfig(prev => ({
          ...prev,
          keywords: targetTitle,
          location: targetLocation,
          skills: skillsList as string[]
        }));
        setCvSynced(true);
        setTimeout(() => setCvSynced(false), 3000);
      }
    } catch (e) {
      console.warn('Failed to auto-sync with CV:', e);
    } finally {
      setSyncingCv(false);
    }
  };

  const handleSearch = () => {
    const finalConfig = {
      ...config,
      location: config.location || 'Portugal',
      remote: config.workMode === 'remote',
      workMode: config.workMode
    };
    onSearch(finalConfig);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl && !importText) return;
    setIsImporting(true);
    if (onImportJob) {
      await onImportJob({
        url: importUrl,
        description: importText,
        title: importTitle,
        company: importCompany
      });
    }
    setIsImporting(false);
    setIsImportOpen(false);
    setImportUrl('');
    setImportText('');
    setImportTitle('');
    setImportCompany('');
  };

  return (
    <div id="search-config-container" className="relative z-[100] w-full flex flex-col gap-4">
      {/* Top Search Bar */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-gradient-to-r from-white/[0.04] to-white/[0.01] p-4 md:p-5 rounded-[2rem] border border-white/10 backdrop-blur-2xl shadow-2xl">
        {/* Keywords */}
        <div className="flex-1 min-w-[200px] w-full relative group">
          <Zap size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-green-400 opacity-50 group-focus-within:opacity-100 transition-opacity" />
          <input
            type="text"
            value={config.keywords}
            onChange={(e) => setConfig(prev => ({ ...prev, keywords: e.target.value }))}
            placeholder="Cargo / Palavras-chave..."
            className="w-full bg-white/5 border border-white/10 rounded-full pl-11 pr-4 py-3 text-xs font-semibold text-white placeholder:text-white/30 focus:outline-none focus:border-green-500/50 transition-all focus:bg-white/10"
          />
        </div>

        {/* Location */}
        <div className="flex-1 min-w-[150px] w-full relative group">
          <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 opacity-50 group-focus-within:opacity-100 transition-opacity" />
          <input
            type="text"
            value={config.location}
            onChange={(e) => setConfig(prev => ({ ...prev, location: e.target.value }))}
            placeholder="Localização..."
            className="w-full bg-white/5 border border-white/10 rounded-full pl-11 pr-4 py-3 text-xs font-semibold text-white placeholder:text-white/30 focus:outline-none focus:border-green-500/50 transition-all focus:bg-white/10"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {/* Sync with CV Button */}
          <button
            type="button"
            onClick={handleSyncWithCv}
            disabled={syncingCv}
            className={`h-11 px-4 rounded-full border text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              cvSynced
                ? 'bg-green-500/20 border-green-500 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
            }`}
            title="Preencher automaticamente palavras-chave e localização a partir do teu CV"
          >
            {syncingCv ? (
              <Loader2 size={13} className="animate-spin text-green-400" />
            ) : cvSynced ? (
              <UserCheck size={13} className="text-green-400" />
            ) : (
              <Sparkles size={13} className="text-green-400" />
            )}
            <span className="hidden sm:inline">{cvSynced ? 'Synced!' : 'My CV'}</span>
          </button>

          {/* Expand Filter Options */}
          <button 
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`h-11 px-4 rounded-full border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              isExpanded 
                ? 'bg-green-500/10 border-green-500/40 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.1)]' 
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            <SlidersVertical size={13} />
            <span className="hidden sm:inline">Filters</span>
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Import Job Button */}
          <button
            onClick={() => setIsImportOpen(true)}
            className="h-11 px-4 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-wider text-white/70 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
            title="Import live job URL or paste Job Description text"
          >
            <Link2 size={13} />
            <span className="hidden sm:inline">Import</span>
          </button>

          <button 
            onClick={handleSearch}
            disabled={loading}
            className="h-11 px-6 bg-white text-black hover:bg-green-400 rounded-full font-black text-[10px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 shadow-xl shadow-white/5 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 transition-all flex-[2] md:flex-none cursor-pointer"
            title="Search live LinkedIn opportunities using current keywords and filters"
          >
            {loading ? <Loader2 size={14} className="animate-spin text-black" /> : <Search size={14} />}
            {loading ? 'Searching...' : 'Hunt Jobs'}
          </button>
        </div>
      </div>

      {/* Expanded Modes (Relative/Push-down) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            className="w-full overflow-hidden"
          >
            <div className="p-8 bg-white/2 border border-white/10 rounded-[2.5rem] backdrop-blur-3xl shadow-[inset_0_0_40px_rgba(255,255,255,0.02)] flex flex-col gap-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {([
                  { id: 'remote',  label: 'Remote',    icon: <Globe size={18} />, desc: '100% Neural Hunt' },
                  { id: 'hybrid',  label: 'Hybrid',    icon: <Home size={18} />, desc: 'Fused Presence' },
                  { id: 'onsite',  label: 'On-site',   icon: <Building2 size={18} />, desc: 'Physical Core' },
                  { id: 'any',     label: 'Universal',  icon: <Search size={18} />, desc: 'No Constraints' },
                ] as const).map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setConfig(prev => ({ ...prev, workMode: mode.id, remote: mode.id === 'remote' }));
                    }}
                    className={`p-6 rounded-[2rem] border text-left transition-all relative overflow-hidden group/item ${
                      config.workMode === mode.id
                        ? 'border-bio-neon-green/40 bg-bio-neon-green/10 shadow-[0_0_30px_rgba(0,255,159,0.1)]'
                        : 'border-white/5 bg-white/2 hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br from-bio-neon-green/5 to-transparent opacity-0 transition-opacity duration-500 ${config.workMode === mode.id ? 'opacity-100' : 'group-hover/item:opacity-50'}`} />
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 rounded-xl ${config.workMode === mode.id ? 'bg-bio-neon-green/20 text-bio-neon-green' : 'bg-white/5 text-white/30 group-hover/item:text-white/60'} transition-all`}>
                          {mode.icon}
                        </div>
                        {config.workMode === mode.id && <div className="w-2 h-2 rounded-full bg-bio-neon-green shadow-bio-neon" />}
                      </div>
                      <div>
                        <p className={`text-xs font-black uppercase tracking-[0.15em] ${config.workMode === mode.id ? 'text-white' : 'text-white/40'}`}>{mode.label}</p>
                        <p className="text-[9px] text-white/20 mt-1 uppercase tracking-widest group-hover/item:text-white/40 transition-colors">{mode.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Advanced Controls Row */}
              <div className="flex items-center justify-between px-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-8">
                   <div className="flex flex-col gap-2">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">Scan Depth (Pages)</span>
                    <div className="flex items-center gap-3">
                      {[1, 2, 3, 5].map(p => (
                        <button
                          key={p}
                          onClick={() => setConfig(prev => ({ ...prev, maxPages: p }))}
                          className={`w-8 h-8 rounded-lg border text-[10px] font-black transition-all ${config.maxPages === p ? 'bg-bio-neon-blue border-bio-neon-blue text-bio-void' : 'border-white/10 text-white/40 hover:border-white/30'}`}
                        >
                          {p}
                        </button>
                      ))}
                      <span className="text-[8px] font-bold text-white/20 ml-2 italic">Higher depth = More results but slower</span>
                    </div>
                  </div>

                  <div className="w-[1px] h-8 bg-white/5" />

                  <div className="flex flex-col gap-2">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">Results Count</span>
                    <div className="flex items-center gap-3">
                      {[2, 5, 10, 25, 50].map(l => (
                        <button
                          key={l}
                          onClick={() => setConfig(prev => ({ ...prev, resultsLimit: l }))}
                          className={`w-8 h-8 rounded-lg border text-[10px] font-black transition-all ${config.resultsLimit === l ? 'bg-bio-neon-green border-bio-neon-green text-bio-void' : 'border-white/10 text-white/40 hover:border-white/30'}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="w-[1px] h-8 bg-white/5" />

                  <div className="flex flex-col gap-2">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">Freshness (Days)</span>
                    <div className="flex items-center gap-3">
                      {[1, 3, 5, 10, 15].map(d => (
                        <button
                          key={d}
                          onClick={() => setConfig(prev => ({ ...prev, maxDays: d }))}
                          className={`w-8 h-8 rounded-lg border text-[10px] font-black transition-all ${config.maxDays === d ? 'bg-orange-500 border-orange-500 text-bio-void' : 'border-white/10 text-white/40 hover:border-white/30'}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Job Modal */}
      <AnimatePresence>
        {isImportOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0c0f1d] border border-white/10 p-6 rounded-3xl max-w-xl w-full space-y-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-bio-neon-blue/10 rounded-xl text-bio-neon-blue border border-bio-neon-blue/30">
                    <Link2 size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Importar Vaga (URL / Texto)</h3>
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Suporta LinkedIn, RemoteOK, Glassdoor, Indeed ou Texto de Vaga</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsImportOpen(false)}
                  className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleImportSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <Globe size={12} className="text-bio-neon-blue" /> URL Direta da Vaga
                  </label>
                  <input
                    type="url"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/jobs/view/... ou https://remoteok.com/..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-bio-neon-blue/40"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={12} className="text-bio-neon-green" /> OU Cole a Descrição do Emprego (Texto Bruto)
                  </label>
                  <textarea
                    rows={4}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Cole aqui o texto da vaga..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-bio-neon-green/40"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-white/40 uppercase tracking-widest">Título do Cargo (Opcional)</label>
                    <input
                      type="text"
                      value={importTitle}
                      onChange={(e) => setImportTitle(e.target.value)}
                      placeholder="Ex: Senior Full Stack Engineer"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-white/40 uppercase tracking-widest">Empresa (Opcional)</label>
                    <input
                      type="text"
                      value={importCompany}
                      onChange={(e) => setImportCompany(e.target.value)}
                      placeholder="Ex: Acme Corp"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsImportOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isImporting || (!importUrl && !importText)}
                    className="px-6 py-2.5 rounded-xl bg-bio-neon-blue text-bio-void font-black text-xs uppercase tracking-widest shadow-bio-cyan disabled:opacity-50 flex items-center gap-2"
                  >
                    {isImporting ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
                    {isImporting ? 'Extraindo Dados Realmente...' : 'Analisar Vaga ao Vivo'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


