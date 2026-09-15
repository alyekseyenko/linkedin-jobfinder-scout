import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Sparkles, CheckCircle2, AlertCircle, Loader2, 
  ExternalLink, ShieldCheck, Terminal, Eye, Send, ArrowRight,
  Maximize2, Minimize2, ZoomIn
} from 'lucide-react';
import { mcpService, type Job } from '../lib/mcp-service';

interface AutoFillModalProps {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
  onMarkAsApplied?: (jobId: string) => void;
}

export default function AutoFillModal({ job, isOpen, onClose, onMarkAsApplied }: AutoFillModalProps) {
  const [status, setStatus] = useState<string>('initializing');
  const [logs, setLogs] = useState<string[]>([]);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [readyForReview, setReadyForReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const jobId = job.linkedin_id || job.id;
  const targetUrl = job.url || (job as any).linkedin_url || (job.linkedin_id ? `https://www.linkedin.com/jobs/view/${job.linkedin_id}` : (job.id ? `https://www.linkedin.com/jobs/view/${job.id}` : ''));

  useEffect(() => {
    if (!isOpen || !jobId) return;

    let isMounted = true;
    let pollInterval: any = null;

    const startSession = async () => {
      try {
        setStatus('running');
        setError(null);
        setReadyForReview(false);
        setLogs([`[${new Date().toLocaleTimeString()}] 🚀 A iniciar sessão de Auto-Fill para ${job.title}...`]);

        await mcpService.startLiveAutofill(jobId, targetUrl);

        // Poll every 1.5s
        pollInterval = setInterval(async () => {
          if (!isMounted) return;
          try {
            const data = await mcpService.getAutofillStatus(jobId);
            if (data && data.found) {
              if (data.logs && Array.isArray(data.logs)) {
                setLogs(data.logs);
              }
              if (data.screenshot) {
                setScreenshot(`data:image/png;base64,${data.screenshot}`);
              }
              if (data.readyForReview) {
                setReadyForReview(true);
                setStatus('ready_for_review');
              }
              if (data.status === 'error') {
                setError(data.error || 'An error occurred during autonomous application autofill.');
                setStatus('error');
              }
            }
          } catch (e) {
            console.warn('[AUTOFILL POLL]', e);
          }
        }, 1500);

      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to initialize autofill engine');
          setStatus('error');
        }
      }
    };

    startSession();

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isOpen, jobId, targetUrl]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className={`fixed inset-0 z-[200] flex items-center justify-center ${isFullScreen ? 'p-0' : 'p-4'} bg-bio-void/90 backdrop-blur-xl transition-all duration-300`}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`relative w-full bg-[#0B0F19] border border-cyan-500/30 ${isFullScreen ? 'h-full max-h-screen rounded-none' : 'max-w-6xl rounded-3xl max-h-[92vh]'} shadow-2xl overflow-hidden flex flex-col transition-all duration-300`}
        >
          {/* Header */}
          <div className="px-8 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Sparkles size={20} className={status === 'running' ? 'animate-spin' : ''} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white tracking-wide">Cockpit de Auto-Fill ao Vivo (HITL)</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[9px] font-black uppercase tracking-widest">
                    Human-in-the-Loop
                  </span>
                </div>
                <p className="text-xs text-white/50 truncate max-w-xl">
                  {job.title} <span className="text-white/20">•</span> {job.company}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsFullScreen(!isFullScreen)}
                title={isFullScreen ? "Sair do Ecrã Inteiro" : "Ecrã Inteiro"}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-cyan-400 transition-all flex items-center gap-1.5 text-xs font-semibold px-3"
              >
                {isFullScreen ? (
                  <>
                    <Minimize2 size={16} />
                    <span className="hidden sm:inline">Restaurar</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={16} />
                    <span className="hidden sm:inline">Ecrã Inteiro</span>
                  </>
                )}
              </button>

              <button 
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Stepper Status Bar */}
          <div className="px-8 py-3 bg-black/40 border-b border-white/5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {readyForReview ? (
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <ShieldCheck size={16} /> Paragem de Segurança Ativa: Pronto para Revisão Humana
                </span>
              ) : status === 'error' ? (
                <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                  <AlertCircle size={16} /> Interrompido: {error}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-cyan-400 font-bold animate-pulse">
                  <Loader2 size={16} className="animate-spin" /> A IA está a preencher o formulário ao vivo...
                </span>
              )}
            </div>

            <div className="text-[10px] text-white/40 uppercase tracking-widest font-mono">
              Fonte do Perfil: user_cv.json + pgvector
            </div>
          </div>

          {/* Body: Split View (Logs on Left, Live View on Right) */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-6 overflow-hidden">
            {/* Terminal Logs (5 cols) */}
            <div className="lg:col-span-5 flex flex-col bg-black/60 rounded-2xl border border-white/10 p-4 overflow-hidden">
              <div className="flex items-center gap-2 pb-3 mb-2 border-b border-white/5 text-[10px] uppercase tracking-widest text-white/40 font-mono">
                <Terminal size={14} className="text-cyan-400" />
                <span>Telemetria do Agente</span>
              </div>
              
              <div className="flex-1 overflow-y-auto font-mono text-xs text-white/70 space-y-2 pr-2 custom-scrollbar">
                {logs.map((log, index) => (
                  <div key={index} className={`leading-relaxed ${log.includes('🛑') || log.includes('🟢') ? 'text-emerald-400 font-bold bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20' : log.includes('❌') ? 'text-rose-400 font-bold' : ''}`}>
                    {log}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>

            {/* Live Screenshot Viewport (7 cols) */}
            <div className="lg:col-span-7 flex flex-col bg-black/60 rounded-2xl border border-white/10 p-4 overflow-hidden">
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/5 text-[10px] uppercase tracking-widest text-white/40 font-mono">
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-cyan-400" />
                  <span>Visor Visual em Tempo Real</span>
                </div>
                <div className="flex items-center gap-3">
                  {screenshot && <span className="text-emerald-400 text-[9px] font-bold">● Sinal de Vídeo Ativo</span>}
                  {screenshot && (
                    <button
                      onClick={() => setIsImageZoomed(true)}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-white/60 hover:text-cyan-300 border border-white/10 flex items-center gap-1 text-[10px] transition-all"
                      title="Expandir imagem em ecrã completo"
                    >
                      <ZoomIn size={12} />
                      <span>Zoom / Fullscreen</span>
                    </button>
                  )}
                </div>
              </div>

              <div 
                className="flex-1 bg-black/40 rounded-xl border border-white/5 flex flex-col items-center justify-center overflow-hidden relative min-h-[300px]"
              >
                {screenshot ? (
                  <div className="relative w-full h-full flex flex-col items-center justify-center group">
                    <img 
                      src={screenshot} 
                      alt="Visão em Tempo Real do Navegador" 
                      className="max-w-full max-h-[420px] object-contain rounded-lg cursor-crosshair border border-cyan-500/20 shadow-xl"
                      onClick={async (e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
                        const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
                        try {
                          setLogs(prev => [...prev, `🖱️ [HITL] Clique manual do utilizador em (${Math.round(xPercent)}%, ${Math.round(yPercent)}%)...`]);
                          const res = await mcpService.sendAutofillClick(jobId, xPercent, yPercent);
                          if (res.screenshot) setScreenshot(`data:image/png;base64,${res.screenshot}`);
                        } catch (err: any) {
                          console.error('Remote click failed:', err);
                        }
                      }}
                    />
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-cyan-500/40 text-[10px] text-cyan-300 font-mono flex items-center gap-2 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      <span>Clica diretamente na imagem para corrigir ou focar um campo • Digita em baixo</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-6 text-white/30 space-y-3">
                    <Loader2 size={32} className="mx-auto animate-spin text-cyan-400" />
                    <p className="text-xs">A capturar o ecrã do navegador...</p>
                  </div>
                )}

                {/* Quick Type Action Input */}
                {screenshot && (
                  <div className="w-full mt-2 pt-2 border-t border-white/10 flex items-center gap-2">
                    <input 
                      type="text"
                      placeholder="Digita texto para enviar ao campo focado e pressiona Enter..."
                      className="flex-1 bg-black/60 border border-white/15 rounded-xl px-4 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                          const textToType = e.currentTarget.value.trim();
                          e.currentTarget.value = '';
                          try {
                            setLogs(prev => [...prev, `⌨️ [HITL] Envio de texto manual: "${textToType}"...`]);
                            const res = await mcpService.sendAutofillType(jobId, textToType);
                            if (res.screenshot) setScreenshot(`data:image/png;base64,${res.screenshot}`);
                          } catch (err: any) {
                            console.error('Remote type failed:', err);
                          }
                        }
                      }}
                    />
                    <span className="text-[10px] text-white/40 font-mono">Press Enter ↵</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Action Bar */}
          <div className="px-8 py-5 border-t border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Controlo Interativo Ativo: clica na imagem para posicionar o cursor. Se deixares de interagir, o Agente resume automaticamente.</span>
            </div>

            <div className="flex items-center gap-3">
              {targetUrl && (
                <button
                  onClick={() => window.open(targetUrl, '_blank', 'noopener,noreferrer')}
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-2 transition-all border border-white/10"
                >
                  <ExternalLink size={14} /> Open Job Page
                </button>
              )}

              {readyForReview && onMarkAsApplied && (
                <button
                  onClick={() => {
                    onMarkAsApplied(jobId);
                    onClose();
                  }}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <CheckCircle2 size={16} /> Confirm Submission & Move to "Applied"
                </button>
              )}

              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>

        {/* Dedicated Full Screen Screenshot Lightbox */}
        <AnimatePresence>
          {isImageZoomed && screenshot && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-2xl flex flex-col p-4 sm:p-6"
            >
              {/* Lightbox Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      Visor Fullscreen ao Vivo Interativo — {job.title}
                    </h4>
                    <p className="text-xs text-white/40">{job.company}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {targetUrl && (
                    <button
                      onClick={() => window.open(targetUrl, '_blank', 'noopener,noreferrer')}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-2 transition-all border border-white/10"
                    >
                      <ExternalLink size={14} /> Abrir Vaga no Navegador
                    </button>
                  )}
                  <button
                    onClick={() => setIsImageZoomed(false)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1.5 text-xs font-bold px-3"
                  >
                    <Minimize2 size={16} />
                    <span>Fechar Zoom (Esc)</span>
                  </button>
                </div>
              </div>

              {/* Lightbox Image Container with Interactive Click */}
              <div 
                className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-auto cursor-crosshair"
              >
                <img 
                  src={screenshot} 
                  alt="Screenshot Ecrã Inteiro"
                  className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/10"
                  onClick={async (e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
                    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
                    try {
                      setLogs(prev => [...prev, `🖱️ [HITL Fullscreen] Clique manual em (${Math.round(xPercent)}%, ${Math.round(yPercent)}%)...`]);
                      const res = await mcpService.sendAutofillClick(jobId, xPercent, yPercent);
                      if (res.screenshot) setScreenshot(`data:image/png;base64,${res.screenshot}`);
                    } catch (err: any) {
                      console.error('Remote click failed:', err);
                    }
                  }} 
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
