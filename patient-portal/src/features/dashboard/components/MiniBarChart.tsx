/**
 * MiniBarChart — inline SVG bar chart for a numeric series.
 * Used for the blood-pressure trend card. Alternates between the
 * current theme accent (currentColor) and a warm accent for visual
 * variety, matching the reference design.
 */

interface Props {
  series: number[];
  width?: number;
  height?: number;
  className?: string;
}

export function MiniBarChart({ series, width = 120, height = 40, className }: Props) {
  if (series.length < 2) return null;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;

  const padX = 4;
  const padY = 4;
  const totalW = width - padX * 2;
  const totalH = height - padY * 2;
  const gap = 6;
  const barW = Math.max(4, (totalW / series.length) - gap);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {series.map((v, i) => {
        const barH = Math.max(4, ((v - min) / range) * totalH);
        const x = padX + i * (barW + gap);
        const y = padY + totalH - barH;
        const isAccent = i % 2 === 1;
        return (
          <rect
            key={i}
            x={x.toFixed(2)}
            y={y.toFixed(2)}
            width={barW.toFixed(2)}
            height={barH.toFixed(2)}
            rx="2"
            fill={isAccent ? "hsl(20 92% 60%)" : "currentColor"}
            opacity={i === series.length - 1 ? 1 : 0.85}
          />
        );
      })}
    </svg>
  );
}
