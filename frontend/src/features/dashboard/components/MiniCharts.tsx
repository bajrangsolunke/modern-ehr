import { motion } from "framer-motion";

/* ──────────────────────────────────────────────────────────────────────
   Top treatment — proportional bubble cluster.
   Bubbles are sized by sqrt(value) so visual area maps to count.
   ────────────────────────────────────────────────────────────────────── */
export function BubbleCluster() {
  const data = [
    { label: "Surgery", value: 240, color: "#4F8CFF" },
    { label: "Consultation", value: 180, color: "#7AB2FF" },
    { label: "Diagnosis", value: 100, color: "#B9D2FF" },
    { label: "Biopsy", value: 60, color: "#DCE8FF" },
  ];
  const maxR = 50;
  const maxVal = Math.max(...data.map((d) => d.value));
  const radii = data.map((d) => Math.sqrt(d.value / maxVal) * maxR);

  // Pack bubbles along a single row, tangent to one another, vertically centered.
  let x = 0;
  const positions = radii.map((r) => {
    const cx = x + r;
    x += r * 2 + 6;
    return cx;
  });
  const totalWidth = x - 6;

  return (
    <div className="relative h-[112px] w-full">
      <svg
        viewBox={`0 0 ${totalWidth} ${maxR * 2}`}
        preserveAspectRatio="xMinYMid meet"
        className="h-full w-full"
      >
        {data.map((d, i) => (
          <motion.g
            key={d.label}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.08, type: "spring", stiffness: 220, damping: 18 }}
            style={{ transformOrigin: `${positions[i]}px ${maxR}px` }}
          >
            <circle cx={positions[i]} cy={maxR} r={radii[i]} fill={d.color} />
            <text
              x={positions[i]}
              y={maxR + 4}
              textAnchor="middle"
              fontSize={Math.max(10, radii[i] * 0.32)}
              fontWeight="700"
              fill={i < 2 ? "white" : "#1E3A8A"}
            >
              {d.value}
            </text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Satisfaction rate — semicircle gauge with tick marks + needle.
   ────────────────────────────────────────────────────────────────────── */
export function GaugeMeter({ value = 85 }: { value?: number }) {
  const cx = 130;
  const cy = 120;
  const rInner = 70;
  const rOuter = 100;
  const ticks = 28;
  const startDeg = 180;
  const sweepDeg = 180;

  const tickCount = Math.round((value / 100) * ticks);

  const needleDeg = startDeg + (value / 100) * sweepDeg;
  const needleRad = (needleDeg * Math.PI) / 180;
  const needleX = cx + Math.cos(needleRad) * (rInner + 8);
  const needleY = cy + Math.sin(needleRad) * (rInner + 8);

  return (
    <div className="relative h-[112px] w-full flex items-end justify-center overflow-hidden">
      <svg viewBox="0 0 260 130" preserveAspectRatio="xMidYEnd meet" className="h-full w-full">
        {Array.from({ length: ticks }).map((_, i) => {
          const deg = startDeg + (sweepDeg * i) / (ticks - 1);
          const rad = (deg * Math.PI) / 180;
          const x1 = cx + Math.cos(rad) * rInner;
          const y1 = cy + Math.sin(rad) * rInner;
          const x2 = cx + Math.cos(rad) * rOuter;
          const y2 = cy + Math.sin(rad) * rOuter;
          const active = i < tickCount;
          return (
            <motion.line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={active ? "#4F8CFF" : "#E6EEF9"}
              strokeWidth={6}
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.015 }}
            />
          );
        })}

        <text x={cx - rOuter + 4} y={cy + 16} fontSize={10} fill="#6B7280">
          0
        </text>
        <text x={cx} y={cy - rOuter + 4} fontSize={10} fill="#6B7280" textAnchor="middle">
          50
        </text>
        <text x={cx + rOuter - 4} y={cy + 16} fontSize={10} fill="#6B7280" textAnchor="end">
          100
        </text>

        <motion.line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="#0F172A"
          strokeWidth={3}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <circle cx={cx} cy={cy} r={6} fill="#0F172A" />
        <circle cx={cx} cy={cy} r={2.5} fill="white" />
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Total patients — segmented horizontal bar with inline labels.
   Each segment width is proportional to its share of the total.
   ────────────────────────────────────────────────────────────────────── */
export function StackedBars() {
  const data = [
    { label: "Inpatient", value: 420, color: "#4F8CFF", textColor: "white" },
    { label: "Discharged", value: 120, color: "#7AB2FF", textColor: "white" },
    { label: "Outpatient", value: 80, color: "#DCE8FF", textColor: "#1E3A8A" },
  ];
  const total = data.reduce((a, b) => a + b.value, 0);

  return (
    <div className="space-y-2">
      <div className="flex h-12 w-full overflow-hidden rounded-full gap-1">
        {data.map((d, i) => {
          const pct = (d.value / total) * 100;
          return (
            <motion.div
              key={d.label}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ delay: i * 0.08, duration: 0.6, ease: "easeOut" }}
              className="flex items-center justify-center font-bold text-[13px] rounded-full"
              style={{ background: d.color, color: d.textColor, minWidth: 36 }}
            >
              {d.value}
            </motion.div>
          );
        })}
      </div>
      <div className="text-[11px] text-muted-foreground text-right">{total} total</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Total appointment — bars + sparkline overlay with average + peak pin.
   ────────────────────────────────────────────────────────────────────── */
export function Sparkline() {
  const points = [12, 18, 14, 22, 16, 26, 20, 28, 24, 30, 22, 32];
  const max = Math.max(...points);
  const min = Math.min(...points);
  const avg = points.reduce((a, b) => a + b, 0) / points.length;

  const w = 260;
  const h = 110;
  const pad = 8;
  const innerH = h - pad * 2;
  const stepX = (w - pad * 2) / (points.length - 1);

  const norm = (v: number) => pad + ((max - v) / (max - min)) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${pad + i * stepX} ${norm(p)}`)
    .join(" ");
  const area = `${path} L ${pad + (points.length - 1) * stepX} ${h - pad} L ${pad} ${h - pad} Z`;

  const peakIdx = points.indexOf(max);
  const peakX = pad + peakIdx * stepX;
  const peakY = norm(max);

  return (
    <div className="relative h-[112px] w-full">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4F8CFF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#4F8CFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {points.map((p, i) => {
          const x = pad + i * stepX;
          const barH = ((p - min) / (max - min)) * (innerH * 0.7) + 4;
          return (
            <motion.rect
              key={i}
              x={x - 4}
              y={h - pad - barH}
              width="8"
              height={barH}
              rx="3"
              fill="#4F8CFF"
              opacity="0.12"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.04, duration: 0.4 }}
              style={{ transformOrigin: `${x}px ${h - pad}px` }}
            />
          );
        })}

        <line
          x1={pad}
          y1={norm(avg)}
          x2={w - pad}
          y2={norm(avg)}
          stroke="#94A3B8"
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        <motion.path
          d={area}
          fill="url(#spark-fill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        />
        <motion.path
          d={path}
          fill="none"
          stroke="#4F8CFF"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />

        <circle
          cx={pad + (points.length - 1) * stepX}
          cy={norm(points[points.length - 1])}
          r={4}
          fill="#4F8CFF"
          stroke="white"
          strokeWidth={2}
        />
        <g>
          <line x1={peakX} y1={peakY} x2={peakX} y2={peakY - 16} stroke="#0F172A" strokeWidth={1} />
          <rect x={peakX - 18} y={peakY - 28} width="36" height="16" rx="8" fill="#0F172A" />
          <text
            x={peakX}
            y={peakY - 17}
            fontSize={10}
            fill="white"
            textAnchor="middle"
            fontWeight="600"
          >
            Peak
          </text>
        </g>
      </svg>
    </div>
  );
}
