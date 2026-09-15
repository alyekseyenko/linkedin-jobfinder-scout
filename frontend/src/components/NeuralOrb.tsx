import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Icosahedron, MeshDistortMaterial, Float, PerspectiveCamera, Sphere } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { Dna, Compass, Activity } from 'lucide-react';

// ─── 3D NEURAL CORE (The Singularity) ──────────────────────────────────────────
function NeuralCore({ isHovered, growthFactor }: { isHovered: boolean; growthFactor: number }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const outerRef = useRef<THREE.Mesh>(null!);
  const innerRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<any>(null!);
  
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const { x, y } = state.mouse;

    // Breathing logic
    const breathe = Math.sin(t * 1.2) * 0.1 + 0.9;
    const pulse = Math.sin(t * 2.5) * 0.3 + 0.7;

    // Layered Rotation
    if (meshRef.current) {
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, t * 0.2 + y * 0.4, 0.05);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, t * 0.3 + x * 0.4, 0.05);
    }
    
    if (outerRef.current) {
      outerRef.current.rotation.y = -t * 0.4;
      outerRef.current.rotation.z = t * 0.2;
    }
    
    if (innerRef.current) {
      innerRef.current.scale.setScalar(THREE.MathUtils.lerp(innerRef.current.scale.x, (isHovered ? 1.2 : 1.0) * breathe, 0.1));
    }

    if (materialRef.current) {
      materialRef.current.emissiveIntensity = THREE.MathUtils.lerp(
        materialRef.current.emissiveIntensity, 
        isHovered ? (2.5 * pulse) : (1.2 * breathe), 
        0.1
      );
      materialRef.current.distort = THREE.MathUtils.lerp(materialRef.current.distort, isHovered ? 0.6 : 0.3, 0.05);
      materialRef.current.speed = THREE.MathUtils.lerp(materialRef.current.speed, isHovered ? 6.0 : 1.5, 0.05);
    }
  });

  return (
    <Float speed={isHovered ? 5 : 2} rotationIntensity={1.5} floatIntensity={2}>
      <group scale={0.7}>
        {/* 1. INTERNAL ENERGY CORE */}
        <Sphere ref={innerRef} args={[0.3, 32, 32]}>
          <meshBasicMaterial color={isHovered ? "#00ff9d" : "#00d2ff"} transparent opacity={0.8} />
          <pointLight intensity={isHovered ? 5 : 2} color={isHovered ? "#00ff9d" : "#00d2ff"} />
        </Sphere>

        {/* 2. ORGANIC DATA SHELL */}
        <Icosahedron ref={meshRef} args={[0.8, 20]} scale={growthFactor}>
          <MeshDistortMaterial
            ref={materialRef}
            color={isHovered ? "#00ff9d" : "#00d2ff"}
            speed={2}
            distort={0.35}
            radius={0.8}
            metalness={0.9}
            roughness={0.1}
            emissive={isHovered ? "#00ff9d" : "#0066ff"}
            emissiveIntensity={1}
            transparent
            opacity={0.6}
          />
        </Icosahedron>

        {/* 3. EXTERNAL GEOMETRIC WIREFRAME */}
        <Icosahedron ref={outerRef} args={[1.4, 2]} scale={growthFactor}>
          <meshBasicMaterial 
            color={isHovered ? "#00ff9d" : "#00d2ff"} 
            wireframe 
            transparent 
            opacity={isHovered ? 0.3 : 0.15} 
          />
        </Icosahedron>
      </group>
    </Float>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
interface NeuralOrbProps {
  state: 'idle' | 'learning';
  knowledgeSize: number;
  activeTab: string;
  onTabSelect: (tab: string) => void;
}

export const NeuralOrb: React.FC<NeuralOrbProps> = ({ state, knowledgeSize, activeTab, onTabSelect }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [whisperIndex, setWhisperIndex] = useState(0);
  
  const isAwake = isHovered;
  const whispers = [
    "Intelligence Latent.",
    "Awaiting Neural Input...",
    "Identity Synced.",
    "Pulse Active.",
    "Synthesizing Narrative..."
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setWhisperIndex((prev) => (prev + 1) % whispers.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [whispers.length]);

  const growthFactor = Math.min(1.2, 1 + (knowledgeSize / 300));
  const expansionDistance = isAwake ? 240 : 40;

  const nodes = [
    { id: 'profile', label: 'DNA CORE', index: '01', x: 0, y: -expansionDistance * 0.9, icon: <Dna size={14} />, color: 'bio-neon-blue' },
    { id: 'career', label: 'STRATEGY', index: '02', x: -expansionDistance * 0.8, y: expansionDistance * 0.4, icon: <Compass size={14} />, color: 'bio-neon-green' },
    { id: 'certs', label: 'NEURAL AURA', index: '03', x: expansionDistance * 0.8, y: expansionDistance * 0.4, icon: <Activity size={14} />, color: 'bio-neon-purple' },
  ];

  const isLearning = state === 'learning';

  return (
    <div 
      className="relative flex items-center justify-center w-full h-[600px] select-none overflow-visible"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 1. 3D CANVAS */}
      <div className="absolute inset-0 z-0">
        <Canvas 
          camera={{ position: [0, 0, 5], fov: 35 }}
          gl={{ antialias: true, alpha: true, powerPreference: "default" }}
          dpr={1}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              console.warn('[WebGL] Context lost in NeuralOrb, awaiting restore...');
            }, false);
            gl.domElement.addEventListener('webglcontextrestored', () => {
              console.info('[WebGL] Context restored in NeuralOrb.');
            }, false);
          }}
        >
          <PerspectiveCamera makeDefault position={[0, 0, 5]} />
          <ambientLight intensity={1.2} />
          <pointLight position={[10, 10, 10]} intensity={3} color={isAwake ? "#00ff9d" : "#00d2ff"} />
          <pointLight position={[-10, -10, -10]} intensity={2} color="#bc13fe" />
          <NeuralCore isHovered={isAwake} growthFactor={growthFactor} />
        </Canvas>
      </div>

      {/* NEURAL WHISPER */}
      <div className="absolute bottom-16 inset-x-0 flex items-center justify-center pointer-events-none z-30">
        <AnimatePresence mode="wait">
          {!isAwake && (
            <motion.div
              key={whisperIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.4, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 1.5 }}
            >
              <span className="text-[9px] font-black uppercase tracking-[1em] text-white/40 drop-shadow-lg">
                {whispers[whisperIndex]}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. NEURAL WEB CONNECTIONS */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
        <AnimatePresence>
          {isAwake && nodes.map((node, i) => (
            <motion.line
              key={`line-${node.id}`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.2 }}
              exit={{ pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.8, delay: i * 0.1 }}
              x1="50%"
              y1="50%"
              x2={`calc(50% + ${node.x}px)`}
              y2={`calc(50% + ${node.y}px)`}
              stroke="url(#lineGradient)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ))}
        </AnimatePresence>
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00ff9d" stopOpacity="0" />
            <stop offset="50%" stopColor="#00d2ff" stopOpacity="1" />
            <stop offset="100%" stopColor="#bc13fe" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* 3. RESPONSIVE ABSTRACT NODES */}
      <motion.div 
        className="relative z-20 flex items-center justify-center w-full h-full"
        animate={{ rotate: isAwake ? 360 : 0 }}
        transition={{ rotate: { repeat: Infinity, duration: 60, ease: "linear" } }}
      >
        {nodes.map((node, i) => {
          const isActive = activeTab === node.id;
          return (
            <motion.div
              key={node.id}
              className="absolute"
              initial={{ x: 0, y: 0, opacity: 0 }}
              animate={{ 
                x: isAwake ? node.x : 0, 
                y: isAwake ? node.y : 0, 
                opacity: isAwake ? 1 : 0,
                scale: isAwake ? 1 : 0.2,
                rotate: isAwake ? -360 : 0 
              }}
              transition={{ 
                x: { type: 'spring', stiffness: 40, damping: 15, delay: i * 0.1 },
                y: { type: 'spring', stiffness: 40, damping: 15, delay: i * 0.1 },
                rotate: { repeat: Infinity, duration: 60, ease: "linear" }
              }}
            >
              <button
                onClick={() => onTabSelect(node.id)}
                className="group relative flex flex-col items-center justify-center"
              >
                <div className={`absolute inset-0 bg-${node.color}/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                <div className={`relative flex flex-col items-center gap-3 p-6 rounded-3xl border transition-all duration-500 backdrop-blur-md ${isActive ? 'bg-white/10 border-white/20 shadow-bio-neon' : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-[8px] font-black tracking-widest opacity-40 ${isActive ? 'text-bio-neon-blue' : 'text-white'}`}>{node.index}</span>
                    <div className={`p-2 rounded-lg bg-white/5 ${isActive ? 'text-bio-neon-green' : 'text-white/40 group-hover:text-white'}`}>
                      {node.icon}
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-[0.4em] transition-all duration-500 ${isActive ? 'text-white drop-shadow-bio-neon' : 'text-white/40 group-hover:text-white'}`}>
                    {node.label}
                  </span>
                  {isActive && (
                    <motion.div layoutId="activeTabIndicator" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-bio-neon-green shadow-bio-neon rounded-full" />
                  )}
                </div>
              </button>
            </motion.div>
          );
        })}
      </motion.div>

      {/* 4. DNA STATUS */}
      <AnimatePresence>
        {isLearning && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-12 flex flex-col items-center gap-4 z-30"
          >
            <div className="h-[1px] w-48 bg-gradient-to-r from-transparent via-bio-neon-green to-transparent" />
            <span className="text-[10px] font-black text-bio-neon-green uppercase tracking-[0.8em] animate-pulse">
              Neural Synthesis Active
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
