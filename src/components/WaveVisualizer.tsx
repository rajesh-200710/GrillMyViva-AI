interface WaveVisualizerProps {
  active: boolean;
  bars?: number;
  accent?: string;
}

export function WaveVisualizer({ active, bars = 28, accent = '#22d3ee' }: WaveVisualizerProps) {
  return (
    <div className="flex items-end justify-center gap-[3px] h-10" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => {
        const delay = `${(i % 7) * 0.12}s`;
        const baseHeight = 20 + Math.abs(Math.sin(i * 0.6)) * 60;
        return (
          <span
            key={i}
            className="w-[3px] rounded-full origin-bottom"
            style={{
              height: `${baseHeight}%`,
              background: `linear-gradient(to top, ${accent}, ${accent}66)`,
              animation: active ? `wave 1.1s ease-in-out infinite` : 'none',
              animationDelay: delay,
              opacity: active ? 1 : 0.25,
              transition: 'opacity 0.3s',
            }}
          />
        );
      })}
    </div>
  );
}
