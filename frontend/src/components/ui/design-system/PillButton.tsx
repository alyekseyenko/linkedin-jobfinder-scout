import React, { ReactNode } from 'react';

interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'emerald';
  icon?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const PillButton: React.FC<PillButtonProps> = ({
  variant = 'secondary',
  icon,
  children,
  size = 'md',
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-4 py-2 text-[10px] gap-1.5',
    md: 'px-6 py-3.5 text-xs gap-2',
    lg: 'px-8 py-4 text-xs gap-2.5',
  };

  const variantClasses = {
    primary:
      'bg-white text-black hover:bg-green-400 shadow-xl shadow-white/5 font-black',
    emerald:
      'bg-green-500 text-black hover:bg-green-400 shadow-[0_0_20px_rgba(34,197,94,0.4)] font-black',
    outline:
      'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 font-black shadow-xl shadow-green-500/5',
    secondary:
      'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white font-black',
    ghost:
      'bg-transparent text-white/50 hover:text-white hover:bg-white/5 font-bold',
  };

  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-full uppercase tracking-widest transition-all duration-300 transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export default PillButton;
