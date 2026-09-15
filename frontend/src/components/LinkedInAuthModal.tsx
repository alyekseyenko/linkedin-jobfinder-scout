import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Key, 
  LogOut, 
  RefreshCw, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Chrome
} from 'lucide-react';
import { mcpService } from '../lib/mcp-service';

interface LinkedInAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (connected: boolean) => void;
}

export const LinkedInAuthModal: React.FC<LinkedInAuthModalProps> = ({
  isOpen,
  onClose,
  onStatusChange
}) => {
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isBrowserLoggingIn, setIsBrowserLoggingIn] = useState(false);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const data = await mcpService.getLinkedInAuthStatus();
      setAuthStatus(data);
      if (onStatusChange) onStatusChange(data.connected);
    } catch (e: any) {
      setFeedback({ type: 'error', text: 'Não foi possível obter o estado da sessão.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchBrowserLogin = () => {
    setIsBrowserLoggingIn(true);
    setFeedback({ 
      type: 'info', 
      text: '🌐 Opening LinkedIn in a new tab... Log in and paste your li_at token below to sync!' 
    });

    // Abrir o LinkedIn diretamente numa nova TAB do mesmo navegador onde o utilizador já está
    window.open('https://www.linkedin.com/login', '_blank', 'noopener,noreferrer');

    // Polling de verificação de sessão
    let attempts = 0;
    const pollTimer = setInterval(async () => {
      attempts++;
      try {
        const data = await mcpService.getLinkedInAuthStatus();
        if (data.connected) {
          clearInterval(pollTimer);
          setIsBrowserLoggingIn(false);
          setAuthStatus(data);
          if (onStatusChange) onStatusChange(true);
          setFeedback({ type: 'success', text: '🎉 Success! LinkedIn account verified and linked.' });
        }
      } catch (_) {}

      if (attempts > 120) {
        clearInterval(pollTimer);
        setIsBrowserLoggingIn(false);
      }
    }, 1500);
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setFeedback(null);
      setTokenInput('');
    }
  }, [isOpen]);

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setFeedback({ type: 'error', text: 'Please enter your li_at session cookie.' });
      return;
    }

    try {
      setIsLoading(true);
      setFeedback({ type: 'info', text: 'Encrypting and validating token in Zero-Trust Vault...' });
      const res = await mcpService.saveLinkedInToken(tokenInput.trim());
      setFeedback({ type: 'success', text: res.message || 'Session connected successfully!' });
      setTokenInput('');
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro ao guardar token.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Tens a certeza que pretendes terminar sessão e remover a ligação ao LinkedIn?')) {
      return;
    }

    try {
      setIsLoading(true);
      setFeedback({ type: 'info', text: 'A revogar credenciais e limpar sessão...' });
      const res = await mcpService.logoutLinkedIn();
      setFeedback({ type: 'success', text: res.message || 'Desconectado com sucesso.' });
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro ao terminar sessão.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = authStatus?.connected;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-[#0B0F19] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="px-8 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-lg ${
                isConnected 
                  ? 'bg-green-500/10 border-green-500/30 text-green-400 shadow-green-500/10' 
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/10'
              }`}>
                {isConnected ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
              </div>
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                  Gestão de Sessão LinkedIn
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${
                    isConnected ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {isConnected ? 'Conectado' : 'Desconectado'}
                  </span>
                </h2>
                <p className="text-xs text-white/50">
                  {isConnected 
                    ? 'A tua conta está associada para busca de emprego e Auto-Fill de candidaturas.' 
                    : 'Liga a tua conta para permitir a pesquisa em tempo real e candidaturas diretas.'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div className={`mx-8 mt-5 p-3.5 rounded-xl border flex items-center gap-3 text-xs font-medium ${
              feedback.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-300' :
              feedback.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-300' :
              'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}>
              {feedback.type === 'success' && <CheckCircle2 size={16} className="text-green-400 shrink-0" />}
              {feedback.type === 'error' && <AlertCircle size={16} className="text-red-400 shrink-0" />}
              {feedback.type === 'info' && <RefreshCw size={16} className="text-blue-400 shrink-0 animate-spin" />}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Body */}
          <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
            
            {/* Status Card */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40 font-mono uppercase tracking-wider">Connection Status:</span>
                <span className="font-bold flex items-center gap-1.5 text-white">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                  {isConnected ? 'Active & Ready' : 'Disconnected'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40 font-mono uppercase tracking-wider">Session Storage:</span>
                <span className="font-mono text-cyan-400">
                  {authStatus?.method === 'browser_profile' ? 'Shared Chrome Browser Profile' :
                   authStatus?.method === 'token' ? 'Zero-Trust Vault (li_at)' : 'None'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40 font-mono uppercase tracking-wider">Scraper & AutoFill Engine:</span>
                <span className={`font-mono ${authStatus?.engineReady ? 'text-green-400' : 'text-amber-400'}`}>
                  {authStatus?.engineReady ? 'Ready' : 'Standby'}
                </span>
              </div>
            </div>

            {/* Option 1: Chrome / Desktop Window (1-Click) */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/30 to-blue-950/20 border border-cyan-500/30 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-cyan-400">
                  <Chrome size={18} />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Option 1: Open LinkedIn in Browser</h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold uppercase border border-cyan-500/30">
                  Direct
                </span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                Click below to open <strong>LinkedIn in a new tab</strong> in your current browser. Log in, then paste your session cookie in the secure vault below.
              </p>
              
              <button
                type="button"
                onClick={handleLaunchBrowserLogin}
                disabled={isBrowserLoggingIn || isLoading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer disabled:opacity-50"
              >
                {isBrowserLoggingIn ? (
                  <>
                    <RefreshCw size={15} className="animate-spin text-black" />
                    <span>Verifying LinkedIn session...</span>
                  </>
                ) : (
                  <>
                    <Chrome size={16} />
                    <span>Open LinkedIn in New Tab</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-[11px] text-white/40 pt-1">
                <span>Opens directly in your current browser window.</span>
                <button
                  type="button"
                  onClick={fetchStatus}
                  className="hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
                  Check Session
                </button>
              </div>
            </div>

            {/* Option 2: li_at Cookie Input */}
            <form onSubmit={handleSaveToken} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
              <div className="flex items-center gap-2.5 text-white/80">
                <Key size={18} className="text-green-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Option 2: Direct li_at Cookie</h3>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                In your browser, open LinkedIn, press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">F12</kbd> ➔ <strong>Application</strong> ➔ <strong>Cookies</strong> ➔ copy the value of <strong>li_at</strong>:
              </p>
              
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="AQED... paste your li_at cookie here"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white placeholder-white/30 text-xs font-mono focus:border-green-500/50 focus:outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !tokenInput.trim()}
                className="w-full py-2.5 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:hover:bg-green-500 text-black text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
              >
                {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                Save & Connect Session
              </button>
            </form>

            {/* Logout Section */}
            {isConnected && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Terminate Session</h4>
                  <p className="text-[11px] text-white/40">Clear saved cookies and disconnect the autonomous system.</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  <LogOut size={14} />
                  Disconnect (Logout)
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
