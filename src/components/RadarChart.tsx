import { useMemo } from 'react';

interface RadarChartProps {
  metrics: { label: string; value: number }[];
  size?: number;
  accent?: string;
}

export function RadarChart({ metrics, size = 320, accent = '#22d3ee' }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.34;
  const levels = 4;
  const n = metrics.length;

  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const point = (i: number, r: number) => ({
    x: cx + Math.cos(angle(i)) * r,
    y: cy + Math.sin(angle(i)) * r,
  });

  const rings = useMemo(
    () =>
      Array.from({ length: levels }, (_, l) => {
        const r = (radius * (l + 1)) / levels;
        const pts = metrics.map((_, i) => {
          const p = point(i, r);
          return `${p.x},${p.y}`;
        });
        return pts.join(' ');
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metrics, size, radius],
  );

  const dataPoints = metrics.map((m, i) => point(i, (radius * m.value) / 100));
  const dataPath = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto" role="img" aria-label="Scorecard radar chart">
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.12" />
        </radialGradient>
      </defs>

      {/* Rings */}
      {rings.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}

      {/* Spokes */}
      {metrics.map((_, i) => {
        const p = point(i, radius);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        );
      })}

      {/* Data shape */}
      <polygon
        points={dataPath}
        fill="url(#radarFill)"
        stroke={accent}
        strokeWidth="2"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 6px ${accent}66)` }}
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={accent} />
      ))}

      {/* Labels */}
      {metrics.map((m, i) => {
        const p = point(i, radius + 28);
        const anchor = Math.abs(p.x - cx) < 8 ? 'middle' : p.x > cx ? 'start' : 'end';
        return (
          <g key={i}>
            <text
              x={p.x}
              y={p.y - 4}
              textAnchor={anchor}
              fill="#cbd5e1"
              fontSize="11"
              fontWeight="600"
            >
              {m.label}
            </text>
            <text
              x={p.x}
              y={p.y + 10}
              textAnchor={anchor}
              fill={accent}
              fontSize="13"
              fontWeight="700"
            >
              {m.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
