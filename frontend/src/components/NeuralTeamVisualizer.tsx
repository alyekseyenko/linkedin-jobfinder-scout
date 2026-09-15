import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, Shield, Search, BrainCircuit, PenTool, 
  Eye, Zap, Activity, Fingerprint, Database 
} from 'lucide-react';
import { useState, useEffect } from 'react';

const agents = [
  { id: 'scout', name: 'Neural Scout', icon: Target, color: '#00D4FF', desc: 'Decoding Job DNA & Requirements...' },
  { id: 'forensics', name: 'Web Forensics', icon: Search, color: '#39FF14', desc: 'Scanning Global Corporate Ecosystem...' },
  { id: 'stalker', name: 'Social Stalker', icon: Eye, color: '#FF00FF', desc: 'Analyzing Decision Maker Psychology...' },
  { id: 'hunter', name: 'Evidence Hunter', icon: Database, color: '#FFD700', desc: 'Mining Knowledge Graph for Proof...' },
  { id: 'crafter', name: 'Persona Voice', icon: PenTool, color: '#FFFFFF', desc: 'Synthesizing Tailored Cover Letter...' },
  { id: 'mirror', name: 'Mirror Agent', icon: Shield, color: '#FF4500', desc: 'Executing Quality Assurance Check...' }
];

export default function NeuralTeamVisualizer() {
  const [activeAgent, setActiveAgent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveAgent((prev) => (prev + 1) % agents.length);
    }, 4000); // Change agent every 4 seconds for a smooth cinematic feel
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-10 w-full">
      <div className="relative w-64 h-64 mb-12">
        {/* Central Brain Core */}
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 90, 180, 270, 360],
            boxShadow: [
              "0 0 20px rgba(0, 212, 255, 0.2)",
              "0 0 60px rgba(0, 212, 255, 0.5)",
              "0 0 20px rgba(0, 212, 255, 0.2)"
            ]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 m-auto w-32 h-32 rounded-full border border-bio-neon-blue/30 flex items-center justify-center bg-bio-neon-blue/5 backdrop-blur-xl z-10"
        >
          <BrainCircuit className="text-bio-neon-blue animate-pulse" size={48} />
        </motion.div>

        {/* Orbiting Agents */}
        <AnimatePresence>
          {agents.map((agent, i) => {
            const angle = (i / agents.length) * (2 * Math.PI);
            const x = Math.cos(angle) * 110;
            const y = Math.sin(angle) * 110;
            const isActive = activeAgent === i;

            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                  opacity: isActive ? 1 : 0.3, 
                  scale: isActive ? 1.2 : 0.8,
                  x, 
                  y,
                  filter: isActive ? 'blur(0px)' : 'blur(1px)'
                }}
                className={`absolute inset-0 m-auto w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-700 ${isActive ? 'bg-white/10 shadow-lg' : 'bg-transparent'}`}
                style={{ 
                  borderColor: isActive ? agent.color : 'rgba(255,255,255,0.05)',
                  boxShadow: isActive ? `0 0 20px ${agent.color}40` : 'none'
                }}
              >
                <agent.icon 
                  size={24} 
                  style={{ color: isActive ? agent.color : 'rgba(255,255,255,0.2)' }} 
                />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Connection Lines (Simulated SVG) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
          <circle cx="128" cy="128" r="110" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="4 4" />
        </svg>
      </div>

      {/* Agent Status UI */}
      <motion.div 
        key={activeAgent}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="flex items-center justify-center gap-3">
          <Badge color={agents[activeAgent].color} />
          <h4 className="text-lg font-black text-white uppercase tracking-[0.4em]">
            {agents[activeAgent].name}
          </h4>
        </div>
        <p className="text-bio-neon-blue font-mono text-[10px] uppercase tracking-widest animate-pulse">
          {agents[activeAgent].desc}
        </p>
        
        {/* Progress Bar */}
        <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden mx-auto mt-6">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 4, ease: "linear" }}
            className="h-full"
            style={{ backgroundColor: agents[activeAgent].color }}
          />
        </div>
      </motion.div>

      {/* Telemetry Footer */}
      <div className="mt-12 flex gap-12 border-t border-white/5 pt-8 opacity-40">
        <div className="text-center">
          <p className="text-[8px] font-black uppercase text-white/40 mb-1">Neural Synapses</p>
          <div className="flex gap-1">
             {[1,2,3,4,5].map(i => <div key={i} className="w-1 h-3 bg-bio-neon-green rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />)}
          </div>
        </div>
        <div className="text-center">
          <p className="text-[8px] font-black uppercase text-white/40 mb-1">Market Frequency</p>
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-yellow-400" />
            <span className="text-[10px] font-mono">82.4 GHz</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ color }: { color: string }) {
  return (
    <div className="flex gap-1">
      <div className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: color }} />
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
    </div>
  );
}
