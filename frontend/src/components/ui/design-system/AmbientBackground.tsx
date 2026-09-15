import React from 'react';

interface AmbientBackgroundProps {
  emeraldPosition?: 'top-right' | 'top-left';
  bluePosition?: 'bottom-left' | 'bottom-right';
  className?: string;
}

export const AmbientBackground: React.FC<AmbientBackgroundProps> = ({
  emeraldPosition = 'top-right',
  bluePosition = 'bottom-left',
  className = '',
}) => {
  const emeraldPosClass =
    emeraldPosition === 'top-right'
      ? 'top-[-10%] right-[-10%]'
      : 'top-[-10%] left-[-10%]';

  const bluePosClass =
    bluePosition === 'bottom-left'
      ? 'bottom-[-10%] left-[-10%]'
      : 'bottom-[-10%] right-[-10%]';

  return (
    <div className={`fixed inset-0 overflow-hidden pointer-events-none -z-10 ${className}`}>
      <div
        className={`absolute ${emeraldPosClass} w-[50%] h-[50%] bg-green-500/5 blur-[120px] rounded-full`}
      />
      <div
        className={`absolute ${bluePosClass} w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full`}
      />
    </div>
  );
};

export default AmbientBackground;
