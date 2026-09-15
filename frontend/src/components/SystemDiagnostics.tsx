import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Eye, 
  BrainCircuit, 
  FileText, 
  Database,
  Zap,
  Play,
  RefreshCcw,
  Key,
  Globe,
  Layers,
  DollarSign,
  Sparkles
} from 'lucide-react';
import { mcpService } from '../lib/mcp-service';

interface TestStep {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'running' | 'success' | 'error';
  result?: string;
  icon: any;
}

export default function SystemDiagnostics({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [steps, setSteps] = useState<TestStep[]>([
    { id: 'linkedin', name: 'LinkedIn Session', description: 'Validating li_at session cookie health', status: 'idle', icon: Key },
    { id: 'qdrant', name: 'Vector Vault', description: 'Checking Qdrant Rust Cluster Health', status: 'idle', icon: Database },
    { id: 'phoenix', name: 'Neural Telemetry', description: 'Validating Arize Phoenix Tracing Stream', status: 'idle', icon: Activity },
    { id: 'cache', name: 'Semantic Cache', description: 'Testing Gemini Embedding & Storage Latency', status: 'idle', icon: Zap },
    { id: 'vision', name: 'Neural Vision', description: 'Initializing Stagehand Browser Engine', status: 'idle', icon: Eye },
    { id: 'brain', name: 'Cognitive Core', description: 'Querying LangGraph & AI Engine (8001)', status: 'idle', icon: BrainCircuit },
    { id: 'probe_search', name: 'Search Probe', description: 'E2E Test: Fetching real LinkedIn nodes', status: 'idle', icon: Globe },
    { id: 'probe_graph', name: 'Cognitive Probe', description: 'E2E Test: Graph Retrieval & Learning Check', status: 'idle', icon: Sparkles },
    { id: 'budget', name: 'Neural Quota Watcher', description: 'Analyzing Token Burn Rate & Account Health', status: 'idle', icon: DollarSign },
    { id: 'probe_db', name: 'Persistence Probe', description: 'E2E Test: Database Write/Delete Cycle', status: 'idle', icon: Database },
  ]);

  const [isRunning, setIsRunning] = useState(false);

  const updateStep = (id: string, updates: Partial<TestStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const runDiagnostic = async () => {
    setIsRunning(true);
    
    const diagnosticActions = [
      { id: 'linkedin', action: () => mcpService.checkLinkedInHealth() },
      { id: 'qdrant', action: () => mcpService.checkQdrantHealth() },
      { id: 'phoenix', action: () => mcpService.checkPhoenixHealth() },
      { id: 'cache', action: () => mcpService.checkCacheHealth() },
      { id: 'vision', action: () => mcpService.initVision() },
      { id: 'brain', action: () => mcpService.getAutopilotStatus() },
      { id: 'probe_search', action: () => mcpService.probeSearch() },
      { id: 'probe_graph', action: () => mcpService.probeGraph() },
      { id: 'budget', action: async () => {
          const budget = await mcpService.getNeuralBudget();
          if (budget.success) {
            return { success: true, message: `Tokens: ${budget.ai_budget.tokens} | Savings: ${budget.ai_budget.savings} | Search: ${budget.search_budget.consumed}/${budget.search_budget.limit}` };
          }
          return budget;
      }},
      { id: 'probe_db', action: () => mcpService.probeDatabase() },
    ];

    for (const step of diagnosticActions) {
      updateStep(step.id, { status: 'running' });
      try {
        const result = await step.action();
        if (result.success || result.enabled !== undefined || result.status === 'ok') {
          updateStep(step.id, { 
            status: 'success', 
            result: result.message || `Operational. ${result.enabled ? 'Active' : ''}` 
          });
        } else {
          updateStep(step.id, { status: 'error', result: result.message || 'Verification Failed' });
        }
      } catch (e: any) {
        updateStep(step.id, { status: 'error', result: e.message || 'Timeout' });
      }
    }

    setIsRunning(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 lg:p-12">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-bio-void/90 backdrop-blur-xl"
      />
      
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-4xl bio-glass rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-bio-neon-blue/10 flex items-center justify-center text-bio-neon-blue border border-bio-neon-blue/20">
              <Activity size={24} className={isRunning ? 'animate-pulse' : ''} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">Neural Diagnostic Center</h2>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em]">Full System Audit Protocol v2.0</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-white/20 hover:text-white transition-colors"
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
          <div className="grid grid-cols-1 gap-3">
            {steps.map((step, idx) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`p-5 rounded-3xl border transition-all duration-500 ${
                  step.status === 'success' ? 'bg-bio-neon-green/5 border-bio-neon-green/20' : 
                  step.status === 'error' ? 'bg-red-500/5 border-red-500/20' : 
                  step.status === 'running' ? 'bg-bio-neon-blue/5 border-bio-neon-blue/40 animate-pulse shadow-bio-neon' : 
                  'bg-white/[0.02] border-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${
                      step.status === 'success' ? 'text-bio-neon-green border-bio-neon-green/30' : 
                      step.status === 'error' ? 'text-red-500 border-red-500/30' : 
                      'text-white/20 border-white/10'
                    }`}>
                      <step.icon size={20} />
                    </div>
                    <div>
                      <h3 className={`text-[11px] font-black uppercase tracking-widest ${
                        step.status === 'success' ? 'text-bio-neon-green' : 
                        step.status === 'error' ? 'text-red-500' : 'text-white'
                      }`}>
                        {step.name}
                      </h3>
                      <p className="text-[9px] font-medium text-white/40 uppercase tracking-wider">{step.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {step.status === 'running' && <Loader2 size={16} className="animate-spin text-bio-neon-blue" />}
                    {step.status === 'success' && <CheckCircle2 size={16} className="text-bio-neon-green" />}
                    {step.status === 'error' && <XCircle size={16} className="text-red-500" />}
                  </div>
                </div>
                
                {step.result && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 pt-3 border-t border-white/5"
                  >
                    <p className="text-[8px] font-mono text-white/50 bg-black/40 p-2.5 rounded-xl break-all">
                      <span className="text-bio-neon-blue mr-2">HANDSHAKE_LOG:</span>
                      {step.result}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-bio-neon-blue animate-ping' : 'bg-white/20'}`} />
             <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
               {isRunning ? 'Auditing Neural Synapses...' : 'System Ready for Audit'}
             </span>
          </div>
          
          <div className="flex gap-4">
            <button
               onClick={() => window.open('http://localhost:6006', '_blank')}
               className="px-6 py-3 rounded-xl border border-bio-neon-blue/20 text-[10px] font-black text-bio-neon-blue uppercase tracking-widest hover:bg-bio-neon-blue/10 transition-all flex items-center gap-2"
            >
               <Activity size={14} /> Open Telemetry
            </button>
            <button
              onClick={() => setSteps(prev => prev.map(s => ({ ...s, status: 'idle', result: undefined })))}
              disabled={isRunning}
              className="px-6 py-3 rounded-xl border border-white/10 text-[10px] font-black text-white/40 uppercase tracking-widest hover:text-white hover:border-white/20 transition-all flex items-center gap-2"
            >
              <RefreshCcw size={14} /> Reset
            </button>
            <button
              onClick={runDiagnostic}
              disabled={isRunning}
              className="px-8 py-3 bg-bio-neon-blue text-bio-void rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-bio-neon hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
            >
              {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {isRunning ? 'Analyzing...' : 'Run Full Audit'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
