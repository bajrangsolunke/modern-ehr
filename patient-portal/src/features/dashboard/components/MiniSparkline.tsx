/**
 * MiniSparkline — inline SVG line chart for a numeric series.
 * No external deps. Scales to container via viewBox.
 * Color via currentColor so the parent controls tone.
 */

interface Props {
  series: number[];
  width?: number;
  height?: number;
  className?: string;
  /** When true, fills the area under the line with a soft currentColor gradient. */
  filled?: boolean;
}

export function MiniSparkline({
  series,
  width = 120,
  height = 40,
  className,
  filled = false,
}: Props) {
  if (series.length < 2) return null;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;

  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const coords = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return { x, y };
  });

  // Smooth path with cubic bezier between each pair of points
  const linePath = coords.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
    const prev = coords[i - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${acc} C ${cx.toFixed(2)},${prev.y.toFixed(2)} ${cx.toFixed(2)},${pt.y.toFixed(2)} ${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
  }, "");

  const last = coords[coords.length - 1];
  const first = coords[0];
  const areaPath = `${linePath} L ${last.x.toFixed(2)},${height} L ${first.x.toFixed(2)},${height} Z`;

  const gradId = `spark-grad-${Math.abs(series.reduce((s, v, i) => s + v * (i + 1), 0)).toFixed(0)}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {filled && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        </>
      )}
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
