import type { AiInsight, ChartPoint } from "@/types";

export const surgeryTrend: ChartPoint[] = Array.from({ length: 12 }).map((_, i) => ({
  label: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
  surgeries: 38 + Math.round(Math.sin(i / 1.4) * 10 + Math.random() * 8),
  consultations: 60 + Math.round(Math.cos(i / 1.2) * 8 + Math.random() * 6),
  emergencies: 12 + Math.round(Math.sin(i / 2) * 4 + Math.random() * 3),
}));

export const complicationTrend: ChartPoint[] = [
  { label: "Feb W1", value: 28 },
  { label: "Feb W2", value: 32 },
  { label: "Feb W3", value: 26 },
  { label: "Feb W4", value: 30 },
  { label: "Mar W1", value: 40 },
  { label: "Mar W2", value: 38 },
  { label: "Mar W3", value: 55 },
  { label: "Mar W4", value: 34 },
  { label: "Apr W1", value: 28 },
  { label: "Apr W2", value: 25 },
  { label: "Apr W3", value: 22 },
];

export const promsTrend: ChartPoint[] = [
  { label: "Feb", satisfaction: 7.4, mobility: 6.2, pain: 4.1 },
  { label: "Feb W2", satisfaction: 7.6, mobility: 6.4, pain: 4.0 },
  { label: "Feb W3", satisfaction: 7.3, mobility: 6.6, pain: 3.8 },
  { label: "Mar", satisfaction: 7.0, mobility: 6.5, pain: 4.2 },
  { label: "Mar W2", satisfaction: 6.8, mobility: 6.0, pain: 4.6 },
  { label: "Mar W3", satisfaction: 7.1, mobility: 6.3, pain: 4.0 },
  { label: "Mar W4", satisfaction: 7.5, mobility: 6.7, pain: 3.7 },
  { label: "Apr", satisfaction: 7.8, mobility: 7.0, pain: 3.5 },
  { label: "Apr W2", satisfaction: 7.9, mobility: 7.2, pain: 3.3 },
];

export const procedureDelayTrend: ChartPoint[] = [
  { label: "Feb", goal: 0, delay: 8 },
  { label: "Feb W2", goal: 0, delay: 9 },
  { label: "Mar", goal: 0, delay: 11 },
  { label: "Mar W2", goal: 0, delay: 12 },
  { label: "Mar W3", goal: 0, delay: 10 },
  { label: "Mar W4", goal: 0, delay: 8 },
  { label: "Apr", goal: 0, delay: 7 },
];

export const heatmapData = [
  { body: "Hand", values: [1, 2, 1, 3, 2, 4] },
  { body: "Foot", values: [3, 2, 4, 2, 1, 3] },
  { body: "Ankle", values: [2, 4, 5, 3, 2, 2] },
  { body: "Shoulder", values: [1, 3, 4, 4, 2, 5] },
  { body: "Knee", values: [4, 5, 3, 4, 5, 4] },
  { body: "Hip", values: [3, 2, 4, 3, 2, 5] },
];

export const readinessTiming: ChartPoint[] = [
  { label: "T-5", ready: 30, partial: 50, notReady: 20 },
  { label: "T-4", ready: 38, partial: 50, notReady: 12 },
  { label: "T-3", ready: 45, partial: 45, notReady: 10 },
  { label: "T-2", ready: 55, partial: 35, notReady: 10 },
  { label: "T-1", ready: 78, partial: 18, notReady: 4 },
];

export const bottlenecks = [
  {
    name: "Late starts",
    percent: "39%",
    trend: "+7%",
    impact: "Procedure delays",
    fix: "Start checklist earlier (T-3)",
    direction: "up",
  },
  {
    name: "OP-Bench delay",
    percent: "24%",
    trend: "-3%",
    impact: "Billing & compliance risk",
    fix: "Add upload reminders",
    direction: "down",
  },
  {
    name: "Low PROM return",
    percent: "61% (goal 80%)",
    trend: "+13%",
    impact: "Incomplete outcomes",
    fix: "Enable SMS nudge",
    direction: "up",
  },
  {
    name: "Department C complications",
    percent: "8.2% vs 3.4% avg",
    trend: "-25%",
    impact: "Patient safety",
    fix: "Review SOPs and case mix",
    direction: "down",
  },
];

export const phaseBottlenecks = [
  {
    phase: "Diagnostics & Risk Review",
    late: "27%",
    avgDelay: "2-3 days",
    department: "Department B",
    action: "Auto-trigger diagnostics earlier",
    completed: true,
  },
  {
    phase: "Consent finalization",
    late: "19%",
    avgDelay: "14 hrs",
    department: "Department C",
    action: "Use digital pre-visit consent",
    completed: true,
  },
  {
    phase: "Anesthesia clearance",
    late: "33%",
    avgDelay: "1-3 days",
    department: "Anesth Team A",
    action: "Pre-weekend review protocol",
    completed: false,
  },
  {
    phase: "Surgical clearance",
    late: "22%",
    avgDelay: "9 hrs",
    department: "Department D",
    action: "Add morning review meeting",
    completed: false,
  },
  {
    phase: "Full checklist completion",
    late: "18%",
    avgDelay: "Varies",
    department: "Mixed",
    action: "Track status in planning view",
    completed: false,
  },
];

export const aiInsights: AiInsight[] = [
  {
    id: "ai-1",
    title: "Late starts driving 39% of OR delays",
    summary:
      "Procedures starting after 9:30 correlate with checklist incomplete at T-3. Auto-trigger pre-op review at T-5.",
    confidence: 0.87,
    category: "operations",
    actions: ["Enable pre-op reminders", "Open bottleneck view"],
  },
  {
    id: "ai-2",
    title: "Cluster of complications in Dept C",
    summary:
      "Knee replacements in Dept C show 8.2% complication rate vs 3.4% baseline. SOP review recommended.",
    confidence: 0.78,
    category: "outcome",
    actions: ["Review SOPs", "Compare case mix"],
  },
  {
    id: "ai-3",
    title: "Low PROM return rate (61%)",
    summary:
      "Goal 80%. Enabling SMS nudge increases response by ~12% historically.",
    confidence: 0.82,
    category: "trend",
    actions: ["Enable SMS nudges"],
  },
];

export const todayKpis = {
  totalToday: 12,
  finished: 8,
  upcoming: 4,
  atRiskTotal: 8,
  atRiskFinished: 5,
  atRiskUpcoming: 3,
};

export const mobileServices = [
  {
    id: "ms-1",
    name: "Lifestyle Monitor",
    status: "Not updated",
    progress: 25,
    metric: "%25",
  },
  {
    id: "ms-2",
    name: "Heart Rate",
    status: "Normal",
    progress: 72,
    metric: "72 bpm",
  },
  {
    id: "ms-3",
    name: "Steps",
    status: "Goal 8000",
    progress: 64,
    metric: "5,103",
  },
];
