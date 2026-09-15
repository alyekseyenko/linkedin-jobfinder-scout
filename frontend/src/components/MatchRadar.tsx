import React from 'react';

interface MatchRadarProps {
  hardSkillsScore?: number;
  domainScore?: number;
  cultureScore?: number;
  salaryScore?: number;
  size?: number;
}

export default function MatchRadar({
  hardSkillsScore = 95,
  domainScore = 85,
  cultureScore = 90,
  salaryScore = 88,
  size = 180
}: MatchRadarProps) {
  const center = size / 2;
  const radius = (size / 2) - 25;

  // 4 Axes: Top (Hard Skills), Right (Domain & Seniority), Bottom (Culture Alignment), Left (Salary Benchmark)
  const axes = [
    { label: 'HARD SKILLS', score: hardSkillsScore, angle: -Math.PI / 2 },
    { label: 'DOMAIN', score: domainScore, angle: 0 },
    { label: 'CULTURE', score: cultureScore, angle: Math.PI / 2 },
    { label: 'SALARY', score: salaryScore, angle: Math.PI }
  ];

  // Helper to convert polar coordinates to SVG Cartesian
  const getPoint = (angle: number, distance: number) => {
    const x = center + distance * Math.cos(angle);
    const y = center + distance * Math.sin(angle);
    return { x, y };
  };

  // Background grid polygons (25%, 50%, 75%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  // Calculate actual candidate score polygon points
  const scorePoints = axes.map(axis => {
    const dist = radius * (Math.min(Math.max(axis.score, 10), 100) / 100);
    return getPoint(axis.angle, dist);
  });

  const polygonPath = scorePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <div className="flex flex-col items-center justify-center relative p-2">
      <svg width={size} height={size} className="overflow-visible">
        <defs>
          <linearGradient id="radarGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00ff9f" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Concentric Grid Circles */}
        {gridLevels.map((lvl, idx) => (
          <circle
            key={idx}
            cx={center}
            cy={center}
            r={radius * lvl}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeDasharray={lvl === 1 ? 'none' : '2 2'}
          />
        ))}

        {/* Axis Lines */}
        {axes.map((axis, i) => {
          const end = getPoint(axis.angle, radius);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="1"
            />
          );
        })}

        {/* Candidate Score Polygon */}
        <polygon
          points={scorePoints.map(p => `${p.x},${p.y}`).join(' ')}
          fill="url(#radarGlow)"
          stroke="#00ff9f"
          strokeWidth="2"
          className="drop-shadow-[0_0_10px_rgba(0,255,159,0.5)] transition-all duration-700 ease-out"
        />

        {/* Vertex Dots */}
        {scorePoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3.5"
            fill="#00ff9f"
            className="drop-shadow-[0_0_6px_rgba(0,255,159,0.8)]"
          />
        ))}

        {/* Axis Labels */}
        {axes.map((axis, i) => {
          const labelPoint = getPoint(axis.angle, radius + 14);
          return (
            <text
              key={i}
              x={labelPoint.x}
              y={labelPoint.y + 3}
              fill="rgba(255, 255, 255, 0.6)"
              fontSize="7"
              fontWeight="900"
              textAnchor="middle"
              className="uppercase tracking-widest font-mono"
            >
              {axis.label} {axis.score}%
            </text>
          );
        })}
      </svg>
    </div>
  );
}
