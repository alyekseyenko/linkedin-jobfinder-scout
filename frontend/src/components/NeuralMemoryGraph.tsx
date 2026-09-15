import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Cpu, Briefcase, Award, RefreshCw, Zap, ShieldCheck, Sparkles, Filter } from 'lucide-react';
import axios from 'axios';

interface Node {
  id: string;
  label: string;
  type: 'candidate' | 'skill' | 'experience' | 'winning_pitch';
  category?: string;
}

interface Edge {
  from: string;
  to: string;
  relation: string;
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

const API_URL = import.meta.env.VITE_API_URL || '';

export default function NeuralMemoryGraph() {
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'skill' | 'experience' | 'winning_pitch'>('all');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const fetchGraphData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/memory/graph`);
      if (response.data && response.data.nodes) {
        setGraph(response.data);
      }
    } catch (err) {
      console.warn('[GRAPH UI WARNING] Failed to load memory graph from backend, using fallback dataset:', err);
      // Fallback display if backend loading
      setGraph({
        nodes: [
          { id: 'c1', label: 'Candidato Master', type: 'candidate' },
          { id: 's1', label: 'React / TypeScript', type: 'skill', category: 'Frontend' },
          { id: 's2', label: 'Python / LangGraph', type: 'skill', category: 'AI Architecture' },
          { id: 's3', label: 'PostgreSQL / pgvector', type: 'skill', category: 'Database' },
          { id: 'e1', label: 'Tech Corp (Lead Software Engineer)', type: 'experience' },
          { id: 'e2', label: 'Innovation Labs (Full-Stack)', type: 'experience' },
          { id: 'w1', label: 'Pitch Vencedor: Senior AI Architect', type: 'winning_pitch' }
        ],
        edges: [
          { from: 'c1', to: 's1', relation: 'DOMINA' },
          { from: 'c1', to: 's2', relation: 'DOMINA' },
          { from: 'c1', to: 's3', relation: 'DOMINA' },
          { from: 'c1', to: 'e1', relation: 'TRABALHOU' },
          { from: 'c1', to: 'e2', relation: 'TRABALHOU' },
          { from: 'c1', to: 'w1', relation: 'PITCH_VENCEDOR' }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  const filteredNodes = graph.nodes.filter(n => filter === 'all' || n.type === filter);

  const getNodeColor = (type: Node['type']) => {
    switch (type) {
      case 'candidate': return 'from-bio-neon-green to-emerald-400 border-bio-neon-green text-bio-void shadow-bio-neon';
      case 'skill': return 'from-bio-neon-blue/20 to-cyan-500/20 border-bio-neon-blue/40 text-bio-neon-blue';
      case 'experience': return 'from-purple-500/20 to-indigo-500/20 border-purple-500/40 text-purple-300';
      case 'winning_pitch': return 'from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-300';
    }
  };

  const getNodeIcon = (type: Node['type']) => {
    switch (type) {
      case 'candidate': return <Brain size={18} />;
      case 'skill': return <Cpu size={14} />;
      case 'experience': return <Briefcase size={14} />;
      case 'winning_pitch': return <Award size={14} />;
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 bg-[#080a14] p-6 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-bio-neon-green/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-bio-neon-blue/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-bio-neon-green/10 rounded-2xl border border-bio-neon-green/30 text-bio-neon-green">
            <Sparkles size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              🧠 Grafo de Memória Neural <span className="text-[10px] px-2 py-0.5 rounded-full bg-bio-neon-green/20 text-bio-neon-green border border-bio-neon-green/40">pgvector + Semantica</span>
            </h2>
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mt-0.5">
              Conexões semânticas do candidato: Competências, Experiência e Pitches Vencedores
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchGraphData}
            disabled={loading}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white/70 flex items-center gap-2 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar Grafo
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest flex items-center gap-1 mr-2">
          <Filter size={12} /> Filtrar Nós:
        </span>
        {[
          { id: 'all', label: 'Todos os Nós' },
          { id: 'skill', label: '⚡ Competências' },
          { id: 'experience', label: '💼 Experiência' },
          { id: 'winning_pitch', label: '🏆 Pitches Vencedores' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              filter === tab.id
                ? 'bg-bio-neon-green/20 border-bio-neon-green text-bio-neon-green shadow-bio-neon'
                : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Graph Visualizer Canvas Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Nodes Cluster Grid */}
        <div className="lg:col-span-2 min-h-[380px] bg-white/[0.02] border border-white/10 rounded-2xl p-6 relative flex flex-wrap content-start gap-3 overflow-y-auto max-h-[480px]">
          {filteredNodes.map(node => (
            <motion.div
              key={node.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedNode(node)}
              className={`cursor-pointer px-4 py-3 rounded-2xl border bg-gradient-to-r ${getNodeColor(node.type)} flex items-center gap-2.5 shadow-lg transition-all`}
            >
              {getNodeIcon(node.type)}
              <span className="text-xs font-extrabold uppercase tracking-wider">{node.label}</span>
              {node.category && (
                <span className="text-[9px] font-black opacity-60 bg-black/30 px-2 py-0.5 rounded-md">
                  {node.category}
                </span>
              )}
            </motion.div>
          ))}
        </div>

        {/* Selected Node Details Panel */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-bio-neon-blue text-xs font-black uppercase tracking-widest border-b border-white/10 pb-3 mb-4">
              <Zap size={14} /> Detalhes do Nó Selecionado
            </div>

            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Tipo de Nó</span>
                  <div className="text-sm font-black text-white uppercase tracking-wider mt-0.5">
                    {selectedNode.type.replace('_', ' ')}
                  </div>
                </div>

                <div>
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Identificador / Conteúdo</span>
                  <div className="text-xs font-bold text-bio-neon-green bg-white/5 p-3 rounded-xl border border-white/10 mt-1">
                    {selectedNode.label}
                  </div>
                </div>

                <div>
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Relações no Grafo</span>
                  <div className="space-y-1.5 mt-2">
                    {graph.edges
                      .filter(e => e.from === selectedNode.id || e.to === selectedNode.id)
                      .map((edge, idx) => (
                        <div key={idx} className="text-[10px] font-mono text-white/60 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                          -[:{edge.relation}]-&gt; {graph.nodes.find(n => n.id === (edge.from === selectedNode.id ? edge.to : edge.from))?.label}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-center text-white/30 space-y-2">
                <Brain size={32} className="opacity-40" />
                <p className="text-xs font-bold uppercase tracking-wider">Clica em qualquer nó do grafo para inspecionar os detalhes e as suas conexões semânticas.</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[9px] font-bold text-white/30 uppercase tracking-widest">
            <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-bio-neon-green" /> Memória Segura Local</span>
            <span>{graph.nodes.length} Nós Ativos</span>
          </div>
        </div>
      </div>
    </div>
  );
}
