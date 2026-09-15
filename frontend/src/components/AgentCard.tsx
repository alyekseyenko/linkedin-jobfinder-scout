import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, BrainCircuit, Sparkles, Binary, Search } from 'lucide-react';

export interface Agent {
  id: string;
  role: string;
  status: 'idle' | 'working' | 'completed';
  icon: 'scout' | 'strategist' | 'crafter' | 'spy';
}

interface AgentCardProps {
  agent: Agent;
  isActive: boolean;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, isActive }) => {
  const icons = {
    scout: <Search size={24} />,
    strategist: <BrainCircuit size={24} />,
    crafter: <Sparkles size={24} />,
    spy: <Binary size={24} />,
  };

  return (
    <motion.div
      layoutId={agent.id}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ 
        opacity: isActive ? 1 : 0.4, 
        scale: isActive ? 1.05 : 1,
        borderColor: isActive ? 'rgba(0, 255, 128, 0.4)' : 'rgba(255, 255, 255, 0.05)'
      }}
      className={`bio-glass p-6 rounded-3xl border flex flex-col items-center gap-4 transition-all duration-500 ${isActive ? 'shadow-bio-neon bg-bio-neon-green/5' : ''}`}
    >
      <motion.div
        animate={isActive ? { 
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0]
        } : {}}
        transition={{ duration: 2, repeat: Infinity }}
        className={`p-4 rounded-2xl ${isActive ? 'bg-bio-neon-green/20 text-bio-neon-green' : 'bg-white/5 text-white/20'}`}
      >
        {icons[agent.icon]}
      </motion.div>
      
      <div className="text-center space-y-1">
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-bio-neon-green' : 'text-white/20'}`}>
          {agent.status}
        </p>
        <h4 className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-white' : 'text-white/40'}`}>
          {agent.role}
        </h4>
      </div>

      {isActive && (
        <motion.div 
          layoutId="active-indicator"
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-1 bg-bio-neon-green rounded-full blur-sm"
        />
      )}
    </motion.div>
  );
};

export default AgentCard;
