import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type MeshState = 'idle' | 'thinking' | 'success' | 'error';

interface MeshGradientProps {
  state: MeshState;
}

import { useVisualSettings } from '../context/VisualSettingsContext';

const MeshGradient: React.FC<MeshGradientProps> = ({ state }) => {
  const { settings } = useVisualSettings();
  const colors = {
    idle: ['#0a0a2e', '#1a0b2e', '#0b1a2e'],
    thinking: ['#001a33', '#003366', '#001a4d'],
    success: ['#002e1a', '#004d33', '#00331a'],
    error: ['#2e0000', '#4d0000', '#330000'],
  };

  const currentColors = colors[state] || colors.idle;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-bio-void">
      {/* Mesh Blobs */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {/* Blob 1 */}
          <div 
            className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full mix-blend-screen filter blur-[120px] animate-mesh-float opacity-40"
            style={{ background: currentColors[0] }}
          />
          {/* Blob 2 */}
          <div 
            className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full mix-blend-screen filter blur-[120px] animate-mesh-float-slow opacity-30"
            style={{ background: currentColors[1] }}
          />
          {/* Blob 3 */}
          <div 
            className="absolute -bottom-[10%] left-[20%] w-[55%] h-[55%] rounded-full mix-blend-screen filter blur-[120px] animate-mesh-float-reverse opacity-35"
            style={{ background: currentColors[2] }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Global Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,var(--bio-void)_100%)] opacity-80" />
      
      {/* Noise Texture */}
      {settings.showNoise && <div className="glass-noise absolute inset-0 pointer-events-none" />}
    </div>
  );
};

export default MeshGradient;
