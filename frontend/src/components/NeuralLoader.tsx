import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Icosahedron, MeshDistortMaterial, Float, Sphere } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';

// ─── Neural Orb Component ──────────────────────────────────────────────────────
function NeuralOrb() {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    meshRef.current.rotation.x = t * 0.2;
    meshRef.current.rotation.y = t * 0.3;
  });

  return (
    <Float speed={4} rotationIntensity={2} floatIntensity={2}>
      <Icosahedron ref={meshRef} args={[1, 15]} scale={2.5}>
        <MeshDistortMaterial
          color="#00ff9d"
          speed={3}
          distort={0.4}
          radius={1}
          metalness={0.8}
          roughness={0.2}
          emissive="#00ff9d"
          emissiveIntensity={0.5}
          transparent
          opacity={0.9}
        />
      </Icosahedron>
      
      {/* Outer Glow Sphere */}
      <Sphere args={[1.2, 32, 32]} scale={2.8}>
        <meshBasicMaterial color="#00ff9d" transparent opacity={0.05} wireframe />
      </Sphere>
    </Float>
  );
}

// ─── Main Loader Component ─────────────────────────────────────────────────────
interface NeuralLoaderProps {
  loading: boolean;
  message?: string;
  subMessage?: string;
}

export default function NeuralLoader({ loading, message = "Accessing Neural Node", subMessage = "Synchronizing AI Intelligence..." }: NeuralLoaderProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timeout: any;
    if (loading) {
      setShow(true);
    } else {
      // Minimum display time of 1.5 seconds
      timeout = setTimeout(() => setShow(false), 1500);
    }
    return () => clearTimeout(timeout);
  }, [loading]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-bio-void flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Custom 3D Neural Orb (No Spline dependency, No 403 errors) */}
          <div className="w-full h-[60vh] relative cursor-wait">
            <Canvas 
              camera={{ position: [0, 0, 8], fov: 45 }}
              gl={{ antialias: false, powerPreference: "default", preserveDrawingBuffer: false }}
              dpr={1}
              onCreated={({ gl }) => {
                gl.domElement.addEventListener('webglcontextlost', (e) => {
                  e.preventDefault();
                  console.warn('[WebGL] Context lost in NeuralLoader, awaiting restore...');
                }, false);
                gl.domElement.addEventListener('webglcontextrestored', () => {
                  console.info('[WebGL] Context restored in NeuralLoader.');
                }, false);
              }}
            >
              <ambientLight intensity={0.5} />
              <pointLight position={[10, 10, 10]} intensity={1.5} color="#00ff9d" />
              <pointLight position={[-10, -10, -10]} intensity={1} color="#00d2ff" />
              <NeuralOrb />
            </Canvas>
            
            {/* Ambient Shadow for depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-bio-void via-transparent to-bio-void pointer-events-none" />
          </div>

          {/* Loading Text Overlay */}
          <div className="relative z-10 text-center space-y-4 -mt-20">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="space-y-2"
            >
              <h2 className="text-2xl font-black text-white uppercase tracking-[0.5em] razer-text-gradient">
                {message}
              </h2>
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] animate-pulse">
                {subMessage}
              </p>
            </motion.div>

            {/* Neural Progress Bar */}
            <div className="w-48 h-1 bg-white/5 rounded-full mx-auto overflow-hidden border border-white/5">
              <motion.div 
                className="h-full bg-bio-neon-green shadow-bio-neon"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
