import React from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Zap, CheckCircle, Fingerprint } from 'lucide-react';

interface VisionEnginePanelProps {
  isVisionActive: boolean;
  isVisionInitializing: boolean;
  isVisionHunting: boolean;
  handleInitVision: () => void;
  handleVisionHunt: () => void;
}

export const VisionEnginePanel: React.FC<VisionEnginePanelProps> = ({
  isVisionActive,
  isVisionInitializing,
  isVisionHunting,
  handleInitVision,
  handleVisionHunt
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      className={`bio-glass p-8 rounded-[3rem] border-white/5 relative overflow-hidden group transition-all duration-700 mt-8 ${isVisionActive ? 'border-bio-neon-blue/40 shadow-bio-neon' : ''}`}
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-all duration-700 ${isVisionActive ? 'bg-bio-neon-blue/20 border-bio-neon-blue shadow-bio-neon animate-pulse' : 'bg-white/5 border-white/10 opacity-30'}`}>
            {isVisionActive ? <Eye size={32} className="text-bio-neon-blue" /> : <EyeOff size={32} />}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-black text-white tracking-tighter uppercase italic">Neural Vision Engine</h3>
              <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-[0.2em] border ${isVisionActive ? 'bg-bio-neon-blue/10 text-bio-neon-blue border-bio-neon-blue/30' : 'bg-white/5 text-white/20 border-white/10'}`}>
                {isVisionActive ? 'Observation: ACTIVE' : 'Observation: STANDBY'}
              </span>
            </div>
            <p className="text-[10px] font-medium text-white/40 leading-relaxed max-w-sm uppercase tracking-wider">Autonomous background hunt engine with anti-ban human simulation.</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!isVisionActive ? (
            <button
              onClick={handleInitVision}
              disabled={isVisionInitializing}
              className="px-12 py-4 bg-bio-neon-blue text-bio-void rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-bio-neon hover:scale-105 transition-all disabled:opacity-50"
            >
              {isVisionInitializing ? 'Connecting Synapses...' : 'Engage Vision Engine'}
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-bio-neon-blue/10 border border-bio-neon-blue/20">
                <div className="w-2 h-2 rounded-full bg-bio-neon-blue animate-ping" />
                <span className="text-[10px] font-black text-bio-neon-blue uppercase tracking-widest">Vision Online</span>
              </div>
              <button
                onClick={handleVisionHunt}
                disabled={isVisionHunting}
                className="px-8 py-3 bg-bio-neon-green text-bio-void rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-bio-neon hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isVisionHunting ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
                {isVisionHunting ? 'Hunting...' : 'Neural Hunt'}
              </button>
            </div>
          )}
        </div>
      </div>

      {isVisionActive && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-8 pt-8 border-t border-white/5"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Validation Status</span>
              <div className="flex items-center gap-2 text-bio-neon-green">
                <CheckCircle size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Semantic Truth Active</span>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Vision Logic</span>
              <div className="flex items-center gap-2 text-bio-neon-purple">
                <Zap size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Gemini 2.0 Flash Verification</span>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Navigation Mode</span>
              <div className="flex items-center gap-2 text-white/60">
                <Fingerprint size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Human-Simulated Intent</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
