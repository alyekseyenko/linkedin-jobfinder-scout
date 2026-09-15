import React, { ReactNode } from 'react';

interface EditorialHeaderProps {
  badgeIcon?: ReactNode;
  badgeText?: string;
  badgeColor?: 'emerald' | 'blue' | 'purple' | 'amber';
  titleMain: string;
  titleSecondary?: string;
  subtitle?: string;
  actions?: ReactNode;
  stats?: Array<{
    icon: ReactNode;
    label: string;
    value?: string | number;
  }>;
  className?: string;
}

export const EditorialHeader: React.FC<EditorialHeaderProps> = ({
  badgeIcon,
  badgeText,
  badgeColor = 'emerald',
  titleMain,
  titleSecondary,
  subtitle,
  actions,
  stats,
  className = '',
}) => {
  const badgeStyles = {
    emerald: 'bg-green-500/10 border-green-500/20 text-green-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  };

  return (
    <header className={`mb-16 md:mb-20 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 md:gap-10">
        <div className="space-y-5">
          {badgeText && (
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-[0.2em] ${badgeStyles[badgeColor]}`}
            >
              {badgeIcon}
              <span>{badgeText}</span>
            </div>
          )}

          <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tighter text-white leading-[0.9] select-none">
            {titleMain}
            <span className="text-green-500">.</span>
            {titleSecondary && (
              <>
                <br />
                <span className="opacity-20 text-white font-black">{titleSecondary}</span>
              </>
            )}
          </h1>

          {subtitle && (
            <p className="text-base sm:text-lg lg:text-xl font-light text-white/60 max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mt-12 pt-8 border-t border-white/5">
          {stats.map((stat, idx) => (
            <div key={idx} className="group flex items-center gap-3.5">
              <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 group-hover:border-green-500/50 transition-colors shrink-0">
                {stat.icon}
              </div>
              <div className="min-w-0">
                {stat.value !== undefined && (
                  <div className="text-sm font-bold text-white tracking-tight truncate">
                    {stat.value}
                  </div>
                )}
                <div className="text-[11px] text-white/40 font-mono truncate">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </header>
  );
};

export default EditorialHeader;
