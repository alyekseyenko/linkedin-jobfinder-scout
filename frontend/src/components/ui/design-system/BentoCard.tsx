import React, { ReactNode } from 'react';

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  onClick?: () => void;
}

export const BentoCard: React.FC<BentoCardProps> = ({
  children,
  className = '',
  hoverEffect = false,
  padding = 'lg',
  onClick,
}) => {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-4 md:p-6',
    md: 'p-6 md:p-8',
    lg: 'p-8 md:p-10',
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-[2rem] md:rounded-[2.5rem] bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/10 backdrop-blur-xl relative overflow-hidden shadow-2xl transition-all duration-300 ${
        hoverEffect ? 'hover:border-white/20 hover:-translate-y-1' : ''
      } ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  );
};

export default BentoCard;
