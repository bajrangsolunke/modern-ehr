/**
 * DateRangeFilter — pill toggle for preset ranges + optional custom picker.
 * Calls onChange({ start, end }) with ISO date strings (YYYY-MM-DD).
 */
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface DateRange {
  start: string;
  end: string;
}

type Preset = "7d" | "30d" | "90d" | "custom";

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function presetRange(preset: Preset): DateRange {
  const end = new Date();
  const start = new Date();
  if (preset === "7d") start.setDate(end.getDate() - 6);
  if (preset === "30d") start.setDate(end.getDate() - 29);
  if (preset === "90d") start.setDate(end.getDate() - 89);
  return { start: toISO(start), end: toISO(end) };
}

function detectPreset(value: DateRange): Preset {
  const end = new Date();
  const diff = Math.round(
    (new Date(value.end).getTime() - new Date(value.start).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const endMatch = value.end === toISO(end);
  if (!endMatch) return "custom";
  if (diff === 6) return "7d";
  if (diff === 29) return "30d";
  if (diff === 89) return "90d";
  return "custom";
}

const PRESETS: { label: string; key: Preset }[] = [
  { label: "Last 7 days", key: "7d" },
  { label: "Last 30 days", key: "30d" },
  { label: "Last 90 days", key: "90d" },
  { label: "Custom", key: "custom" },
];

export function DateRangeFilter({ value, onChange }: Props) {
  const active = detectPreset(value);
  const [customStart, setCustomStart] = useState(value.start);
  const [customEnd, setCustomEnd] = useState(value.end);

  function handlePreset(key: Preset) {
    if (key === "custom") return; // open panel only
    const range = presetRange(key);
    setCustomStart(range.start);
    setCustomEnd(range.end);
    onChange(range);
  }

  function applyCustom() {
    if (customStart && customEnd && customStart <= customEnd) {
      onChange({ start: customStart, end: customEnd });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center bg-secondary rounded-full p-0.5 gap-0.5">
        {PRESETS.map(({ label, key }) => (
          <button
            key={key}
            onClick={() => handlePreset(key)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-full transition",
              active === key
                ? "bg-white text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {active === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            max={customEnd}
            onChange={(e) => setCustomStart(e.target.value)}
            className="h-7 rounded-lg border border-border bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={customEnd}
            min={customStart}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="h-7 rounded-lg border border-border bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={applyCustom}
            className="h-7 px-3 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

