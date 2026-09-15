import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Loader2 } from 'lucide-react';

interface AutopilotConfig {
  enabled: boolean;
  todayCount: number;
  dailyLimit: number;
  totalJobsFound: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

interface AutopilotPanelProps {
  autopilotPanelRef: React.RefObject<HTMLDivElement>;
  autopilot: AutopilotConfig | null;
  autopilotLoading: boolean;
  autopilotLimitInput: number;
  autopilotIntervalInput: number;
  autopilotPagesInput: number;
  setAutopilotLimitInput: (val: number) => void;
  setAutopilotIntervalInput: (val: number) => void;
  setAutopilotPagesInput: (val: number) => void;
  handleToggleAutopilot: () => void;
  handleSaveAutopilotConfig: () => void;
}

export const AutopilotPanel: React.FC<AutopilotPanelProps> = ({
  autopilotPanelRef,
  autopilot,
  autopilotLoading,
  autopilotLimitInput,
  autopilotIntervalInput,
  autopilotPagesInput,
  setAutopilotLimitInput,
  setAutopilotIntervalInput,
  setAutopilotPagesInput,
  handleToggleAutopilot,
  handleSaveAutopilotConfig
}) => {
  return (
    <motion.div 
      ref={autopilotPanelRef}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      className="bio-glass p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${autopilot?.enabled ? 'from-bio-neon-blue/5' : 'from-white/2'} to-transparent opacity-50`} />
      
      <div className="relative z-10 flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between">
        <div className="flex items-center gap-6">
          <div className={`w-16 h-16 rounded-2xl ${autopilot?.enabled ? 'bg-bio-neon-blue/10 text-bio-neon-blue shadow-[0_0_30px_rgba(0,212,255,0.2)]' : 'bg-white/5 text-white/20'} flex items-center justify-center border border-white/10 transition-all duration-700`}>
            <Zap size={32} className={autopilot?.enabled ? 'animate-pulse' : ''} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-black text-white tracking-tighter uppercase italic">Neural Autopilot</h3>
              <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-[0.2em] border ${autopilot?.enabled ? 'bg-bio-neon-blue/10 text-bio-neon-blue border-bio-neon-blue/30' : 'bg-white/5 text-white/20 border-white/10'}`}>
                {autopilot?.enabled ? 'Systems Active' : 'Standby Mode'}
              </span>
            </div>
            <p className="text-[10px] font-medium text-white/40 leading-relaxed max-w-sm uppercase tracking-wider">Autonomous background hunt engine with anti-ban human simulation.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Healthy Limits Config */}
          <div className="flex gap-4 p-2 bg-black/40 rounded-2xl border border-white/5">
            <div className="space-y-2 px-3">
              <label className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">Hunts / Day</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  min="1" 
                  max="5" 
                  value={autopilotLimitInput}
                  onChange={(e) => setAutopilotLimitInput(parseInt(e.target.value) || 1)}
                  className="w-10 bg-transparent text-xs font-black text-bio-neon-blue outline-none border-b border-white/10 text-center"
                />
                <span className="text-[8px] font-bold text-white/30">/ 5</span>
              </div>
            </div>
            <div className="w-[1px] h-8 bg-white/5 mt-2" />
            <div className="space-y-2 px-3">
              <label className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">Frequency</label>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold text-white/30 italic">Every</span>
                <input 
                  type="number" 
                  min="3" 
                  max="24" 
                  value={autopilotIntervalInput}
                  onChange={(e) => setAutopilotIntervalInput(parseInt(e.target.value) || 3)}
                  className="w-10 bg-transparent text-xs font-black text-bio-neon-blue outline-none border-b border-white/10 text-center"
                />
                <span className="text-[8px] font-bold text-white/30">H</span>
              </div>
            </div>
            <div className="w-[1px] h-8 bg-white/5 mt-2" />
            <div className="space-y-2 px-3">
              <label className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">Scan Depth</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  min="1" 
                  max="5" 
                  value={autopilotPagesInput}
                  onChange={(e) => setAutopilotPagesInput(parseInt(e.target.value) || 1)}
                  className="w-10 bg-transparent text-xs font-black text-bio-neon-purple outline-none border-b border-white/10 text-center"
                />
                <span className="text-[8px] font-bold text-white/30">Pgs</span>
              </div>
            </div>
          </div>

          {/* Master Toggle */}
          <div className="flex flex-col gap-2">
             <button
              disabled={autopilotLoading}
              onClick={handleToggleAutopilot}
              className={`relative h-14 px-10 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all duration-500 overflow-hidden group/toggle ${autopilot?.enabled ? 'bg-bio-neon-blue text-bio-void shadow-[0_0_40px_rgba(0,212,255,0.3)]' : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'}`}
            >
              <div className="relative z-10 flex items-center gap-3">
                {autopilotLoading ? <Loader2 size={14} className="animate-spin" /> : (autopilot?.enabled ? 'Engaged' : 'Ignite Autopilot')}
              </div>
            </button>
            {autopilot?.enabled && (
              <button onClick={handleSaveAutopilotConfig} className="text-[7px] font-black text-white/20 uppercase tracking-widest hover:text-bio-neon-blue transition-colors text-center">Update Pulse Settings</button>
            )}
          </div>
        </div>
      </div>

       {/* Autopilot Telemetry */}
       {autopilot?.enabled && (
         <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-6">
           <div className="space-y-1">
             <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">Hunts Today</span>
             <div className="text-sm font-black text-white italic">{autopilot.todayCount} / {autopilot.dailyLimit}</div>
           </div>
           <div className="space-y-1">
             <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">Total Nodes Found</span>
             <div className="text-sm font-black text-bio-neon-green italic">+{autopilot.totalJobsFound}</div>
           </div>
           <div className="space-y-1">
             <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">Last Activity</span>
             <div className="text-[9px] font-bold text-white/50 uppercase">{autopilot.lastRunAt ? new Date(autopilot.lastRunAt).toLocaleTimeString() : 'Awaiting First Run'}</div>
           </div>
           <div className="space-y-1">
             <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">Next Scheduled Sync</span>
             <div className="text-[9px] font-bold text-bio-neon-blue uppercase animate-pulse">{autopilot.nextRunAt ? new Date(autopilot.nextRunAt).toLocaleTimeString() : 'Calculating Sync Window...'}</div>
           </div>
         </div>
       )}
    </motion.div>
  );
};
