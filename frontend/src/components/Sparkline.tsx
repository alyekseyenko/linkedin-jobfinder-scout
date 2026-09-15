import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

interface SparklineProps {
  data: { v: number }[];
  color?: string;
  height?: number;
}

export default function Sparkline({ data, color = '#00ff9d', height = 28 }: SparklineProps) {
  if (!data || data.length < 2) return null;

  return (
    <ResponsiveContainer width={60} height={height}>
      <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={true}
          animationDuration={1000}
        />
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="text-[8px] font-black text-black bg-bio-neon-green px-1.5 py-0.5 rounded">
                {payload[0].value}
              </div>
            ) : null
          }
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
