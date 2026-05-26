import { motion } from "framer-motion";

/* Bubble cluster (Top treatment) */
export function BubbleCluster() {
  const bubbles = [
    { size: 64, value: 180, color: "#4F8CFF", x: 0, y: 16 },
    { size: 80, value: 240, color: "#7AB2FF", x: 56, y: 0 },
    { size: 48, value: 100, color: "#B9D2FF", x: 132, y: 24 },
    { size: 36, value: 60, color: "#DCE8FF", x: 180, y: 36 },
  ];
  return (
    <div className="relative h-20 w-full">
      {bubbles.map((b, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i * 0.07, type: "spring", stiffness: 200 }}
          className="absolute rounded-full grid place-items-center text-white text-[10px] font-bold"
          style={{
            width: b.size,
            height: b.size,
            left: b.x,
            top: b.y,
            background: b.color,
          }}
        >
          {b.value}
        </motion.div>
      ))}
    </div>
  );
}

/* Half-circle gauge (Satisfaction rate) */
export function GaugeMeter({ value = 85 }: { value?: number }) {
  const ticks = 18;
  const arc = 180;
  const active = Math.round((value / 100) * ticks);
  return (
    <div className="relative h-20 w-full flex items-end justify-center overflow-hidden">
      <svg width="220" height="110" viewBox="0 0 220 110">
        {Array.from({ length: ticks }).map((_, i) => {
          const angle = (arc * i) / (ticks - 1) - 90;
          const rad = (angle * Math.PI) / 180;
          const x1 = 110 + Math.cos(rad) * 78;
          const y1 = 100 + Math.sin(rad) * 78;
          const x2 = 110 + Math.cos(rad) * 96;
          const y2 = 100 + Math.sin(rad) * 96;
          const isActive = i < active;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isActive ? "#4F8CFF" : "#E6EEF9"}
              strokeWidth="5"
              strokeLinecap="round"
            />
          );
        })}
        <text x="14" y="106" fontSize="9" fill="#6B7280">0</text>
        <text x="50" y="36" fontSize="9" fill="#6B7280">25</text>
        <text x="100" y="14" fontSize="9" fill="#6B7280">50</text>
        <text x="160" y="36" fontSize="9" fill="#6B7280">75</text>
        <text x="200" y="106" fontSize="9" fill="#6B7280">100</text>
        <motion.line
          x1="110"
          y1="100"
          x2={110 + Math.cos(((arc * (value / 100) - 90) * Math.PI) / 180) * 70}
          y2={100 + Math.sin(((arc * (value / 100) - 90) * Math.PI) / 180) * 70}
          stroke="#111827"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1 }}
        />
        <circle cx="110" cy="100" r="4" fill="#111827" />
      </svg>
    </div>
  );
}

/* Stacked bar trio (Total patients) */
export function StackedBars() {
  const bars = [
    { value: 420, color: "#4F8CFF", label: "420" },
    { value: 120, color: "#7AB2FF", label: "120" },
    { value: 80, color: "#DCE8FF", label: "80" },
  ];
  const total = bars.reduce((s, b) => s + b.value, 0);
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1 h-9 items-end">
        {bars.map((b, i) => (
          <motion.div
            key={i}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-md origin-bottom flex items-center justify-center text-[10px] font-semibold text-white"
            style={{
              flex: b.value,
              height: `${(b.value / Math.max(...bars.map((x) => x.value))) * 100}%`,
              minHeight: 24,
              background: b.color,
            }}
          >
            <span style={{ color: b.color === "#DCE8FF" ? "#4F8CFF" : "white" }}>
              {b.label}
            </span>
          </motion.div>
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground text-right">{total} total</div>
    </div>
  );
}

/* Sparkline (Total appointments) */
export function Sparkline() {
  const points = [12, 18, 14, 22, 16, 26, 20, 28, 24, 30, 22, 32];
  const max = Math.max(...points);
  const min = Math.min(...points);
  const w = 220;
  const h = 64;
  const pad = 4;
  const stepX = (w - pad * 2) / (points.length - 1);
  const norm = (v: number) =>
    h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${pad + i * stepX} ${norm(p)}`)
    .join(" ");
  const area = `${path} L ${pad + (points.length - 1) * stepX} ${h} L ${pad} ${h} Z`;

  return (
    <div className="h-20 w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
        <defs>
          <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4F8CFF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#4F8CFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={area}
          fill="url(#spark)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        />
        <motion.path
          d={path}
          fill="none"
          stroke="#4F8CFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        <circle
          cx={pad + (points.length - 1) * stepX}
          cy={norm(points[points.length - 1])}
          r="3.5"
          fill="#4F8CFF"
        />
      </svg>
    </div>
  );
}
