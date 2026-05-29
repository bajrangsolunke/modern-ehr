import {
  CheckCircle2,
  FlaskConical,
  Pill,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface JourneyItem {
  icon: React.ReactNode;
  tint: string;
  title: string;
  detail: string;
  time: string;
}

const ITEMS: JourneyItem[] = [
  {
    icon: <CheckCircle2 className="size-3.5" />,
    tint: "bg-emerald-500",
    title: "Appointment completed",
    detail: "Orthopedics consult with Dr. Wanda",
    time: "2 days ago",
  },
  {
    icon: <FlaskConical className="size-3.5" />,
    tint: "bg-amber-500",
    title: "Lab result uploaded",
    detail: "Pathology sample · Reviewed by AI",
    time: "5 days ago",
  },
  {
    icon: <Pill className="size-3.5" />,
    tint: "bg-violet-500",
    title: "Medication updated",
    detail: "Metformin dosage adjusted to 1000mg",
    time: "1 week ago",
  },
  {
    icon: <ShieldCheck className="size-3.5" />,
    tint: "bg-primary",
    title: "Insurance approved",
    detail: "Coverage renewed through Jan 2027",
    time: "3 weeks ago",
  },
  {
    icon: <Stethoscope className="size-3.5" />,
    tint: "bg-slate-500",
    title: "Annual physical scheduled",
    detail: "Booked with Dr. Robert Fox",
    time: "1 month ago",
  },
];

export function HealthJourneyTimeline() {
  return (
    <Card
      className={cn(
        "p-5 lg:p-6 rounded-3xl border-slate-200/70 bg-white",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-14px_rgba(15,23,42,0.10)]"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14.5px] font-semibold tracking-tight text-slate-900">
            Health journey
          </h3>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Your recent care activity
          </p>
        </div>
        <button className="text-[12px] font-semibold text-primary hover:underline">
          Full history
        </button>
      </div>

      <ol className="relative">
        {/* Vertical line */}
        <span
          aria-hidden
          className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-slate-200 via-slate-100 to-transparent"
        />
        {ITEMS.map((item, i) => (
          <li
            key={i}
            className={cn("relative flex items-start gap-3", i !== ITEMS.length - 1 && "pb-4")}
          >
            <div
              className={cn(
                "relative z-10 size-8 rounded-full grid place-items-center text-white shrink-0 ring-4 ring-white shadow-sm",
                item.tint
              )}
            >
              {item.icon}
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-semibold text-slate-900 truncate">
                  {item.title}
                </div>
                <div className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                  {item.time}
                </div>
              </div>
              <div className="text-[12px] text-slate-500 mt-0.5 truncate">
                {item.detail}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
