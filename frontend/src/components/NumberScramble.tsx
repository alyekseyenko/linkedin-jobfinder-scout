import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface NumberScrambleProps {
  value: number;
  suffix?: string;
  duration?: number;
}

export default function NumberScramble({ value, suffix = '', duration = 1.5 }: NumberScrambleProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const range = end - start;
    let current = start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration * 1000 / range));
    
    // Safety check for very large ranges
    const effectiveStepTime = Math.max(stepTime, 10);

    const timer = setInterval(() => {
      current += increment;
      setDisplayValue(current);
      if (current === end) {
        clearInterval(timer);
      }
    }, effectiveStepTime);

    return () => clearInterval(timer);
  }, [value, duration]);

  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="font-mono"
    >
      {displayValue}{suffix}
    </motion.span>
  );
}
