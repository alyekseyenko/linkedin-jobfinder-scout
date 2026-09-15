import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, Cpu, Globe, Zap, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';

interface NeuralVaultLoaderProps {
  loading: boolean;
  isSuccess?: boolean;
}

export default function NeuralVaultLoader({ loading, isSuccess }: NeuralVaultLoaderProps) {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (loading) {
      setIsVisible(true);
      const timer1 = setTimeout(() => setStep(1), 1000);
      const timer2 = setTimeout(() => setStep(2), 2000);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else if (isSuccess) {
      setStep(3);
      setIsVisible(true);
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      setStep(0);
    }
  }, [loading, isSuccess]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-bio-void flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Ambient Grid Background */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
          
          <div className="relative flex flex-col items-center max-w-xl w-full px-8 text-center space-y-12">
            
            {/* Central Icon Morphing */}
            <div className="relative w-32 h-32 flex items-center justify-center">
               <motion.div 
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 90, 180, 270, 360],
                    borderColor: ['rgba(0,255,157,0.2)', 'rgba(0,210,255,0.2)', 'rgba(0,255,157,0.2)']
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-2 border-dashed rounded-[3rem]"
               />
               
               <AnimatePresence mode="wait">
                  {step === 0 && (
                    <motion.div key="lock" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}>
                        <Lock size={48} className="text-white/20" />
                    </motion.div>
                  )}
                  {step === 1 && (
                    <motion.div key="shield" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}>
                        <Shield size={48} className="text-bio-neon-blue shadow-bio-cyan" />
                    </motion.div>
                  )}
                  {step >= 2 && (
                    <motion.div key="zap" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}>
                        <Zap size={48} className="text-bio-neon-green shadow-bio-neon" />
                    </motion.div>
                  )}
               </AnimatePresence>
            </div>

            {/* Sequence Text */}
            <div className="space-y-6 min-h-[120px]">
                <AnimatePresence mode="wait">
                  {step === 0 && (
                    <motion.div 
                      key="step0"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-2"
                    >
                      <h2 className="text-3xl font-black text-white uppercase tracking-[0.4em] razer-text-gradient">NEURAL VAULT</h2>
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">SYSTEM VERSION 2026.4.1</p>
                    </motion.div>
                  )}
                  {step === 1 && (
                    <motion.div 
                      key="step1"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-2"
                    >
                      <h2 className="text-3xl font-black text-bio-neon-blue uppercase tracking-[0.2em] shadow-bio-cyan">IDENTITY AUTHENTICATED</h2>
                      <p className="text-[10px] font-black text-bio-neon-blue/40 uppercase tracking-[0.5em]">Cognitive Signature Validated</p>
                    </motion.div>
                  )}
                  {step === 2 && (
                    <motion.div 
                      key="step2"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-2"
                    >
                      <h2 className="text-3xl font-black text-bio-neon-green uppercase tracking-[0.2em] shadow-bio-neon">BIO-LINK ACTIVE</h2>
                      <p className="text-[10px] font-black text-bio-neon-green/40 uppercase tracking-[0.5em]">Synchronizing Intelligence Nodes</p>
                    </motion.div>
                  )}
                  {step === 3 && (
                    <motion.div 
                      key="step3"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-center gap-3">
                         <Sparkles className="text-bio-neon-green" size={24} />
                         <h2 className="text-3xl font-black text-white uppercase tracking-[0.3em]">LEARNING COMPLETE</h2>
                      </div>
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">Vault Encrypted & Updated</p>
                    </motion.div>
                  )}
                </AnimatePresence>
            </div>

            {/* Neural Progress Bar */}
            <div className="w-full max-w-sm h-1 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
              <motion.div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-bio-neon-blue via-bio-neon-green to-bio-neon-blue"
                initial={{ width: "0%" }}
                animate={{ width: `${(step + 1) * 25}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
