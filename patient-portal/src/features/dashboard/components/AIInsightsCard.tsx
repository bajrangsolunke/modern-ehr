import { ChevronRight, Sparkles, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Insight {
  text: string;
  confidence: number;
}

const INSIGHTS: Insight[] = [
  {
    text: "Blood pressure has remained stable for 14 days.",
    confidence: 96,
  },
  {
    text: "Glucose trends improved by 8% this month.",
    confidence: 92,
  },
  {
    text: "Your sleep quality improved after the recent medication adjustment.",
    confidence: 88,
  },
];

export function AIInsightsCard() {
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-0 rounded-[28px] border-0 text-white",
        "bg-gradient-to-br from-[#5B21B6] via-[#6D28D9] to-[#3B73E6]",
        "shadow-[0_10px_36px_-12px_rgba(91,33,182,0.55),0_2px_4px_rgba(15,23,42,0.06)]"
      )}
    >
      <div
        aria-hidden
        className="absolute -top-16 -right-12 size-48 rounded-full bg-white/15 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-20 -left-12 size-44 rounded-full bg-white/10 blur-3xl"
      />

      <div className="relative p-5 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2">
            <div className="size-10 rounded-2xl bg-white/20 backdrop-blur grid place-items-center">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/70 font-bold">
                AI Health Insight
              </div>
              <div className="text-[15px] font-semibold">Personalized for you</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur px-2 py-1 text-[10px] font-semibold">
            <TrendingUp className="size-3" />
            Updated now
          </span>
        </div>

        <ul className="space-y-2.5">
          {INSIGHTS.map((insight, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-2xl bg-white/10 backdrop-blur border border-white/15 px-3.5 py-2.5"
            >
              <div className="mt-0.5 size-6 rounded-lg bg-white/20 grid place-items-center shrink-0">
                <Sparkles className="size-3" />
              </div>
              <p className="text-[12.5px] leading-relaxed text-white/95 flex-1">
                {insight.text}
              </p>
              <span className="text-[10px] font-bold tabular-nums text-white/90 shrink-0 mt-1">
                {insight.confidence}%
              </span>
            </li>
          ))}
        </ul>

        <button className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-white/90 hover:text-white transition">
          View health timeline <ChevronRight className="size-3.5" />
        </button>
      </div>
    </Card>
  );
}
