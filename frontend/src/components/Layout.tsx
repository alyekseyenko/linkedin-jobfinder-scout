import React, { useEffect, ReactNode, Suspense, lazy } from 'react';
import Lenis from 'lenis';
import MeshGradient, { type MeshState } from './MeshGradient';
import { useGlowTracking } from '../hooks/useGlowTracking';

import NeuralParticleField from './NeuralParticleField';

interface LayoutProps {
  children: ReactNode;
  aiState?: MeshState;
  skills?: string[];
  categories?: Record<string, string[]>;
}

import { useVisualSettings } from '../context/VisualSettingsContext';

const Layout: React.FC<LayoutProps> = ({ children, aiState = 'idle', skills = [], categories = {} }) => {
  const { settings } = useVisualSettings();
  useGlowTracking();
  
  useEffect(() => {
    // ... (lenis logic)
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="relative min-h-screen selection:bg-bio-neon-green/30 selection:text-white">
      {/* Ambient mesh gradient (clean dark background) */}
      <MeshGradient state={aiState} />

      {/* Layer 2: App content */}
      <div className={`relative z-10 min-h-screen ${settings.showNoise ? 'glass-noise' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default Layout;
