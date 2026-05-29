import {
  Download,
  FileText,
  FlaskConical,
  Receipt,
  ScrollText,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { DashboardRecentDocument } from "@/features/dashboard/api/dashboard-api";

function categoryStyle(category: string): { icon: React.ReactNode; tint: string } {
  const c = category.toLowerCase();
  if (c.includes("lab")) {
    return {
      icon: <FlaskConical className="size-4" />,
      tint: "bg-amber-50 text-amber-600",
    };
  }
  if (c.includes("path") || c.includes("clinical") || c.includes("consult")) {
    return {
      icon: <Stethoscope className="size-4" />,
      tint: "bg-emerald-50 text-emerald-600",
    };
  }
  if (c.includes("prescription") || c.includes("rx")) {
    return {
      icon: <ScrollText className="size-4" />,
      tint: "bg-violet-50 text-violet-600",
    };
  }
  if (c.includes("insurance") || c.includes("bill") || c.includes("invoice")) {
    return {
      icon: <Receipt className="size-4" />,
      tint: "bg-rose-50 text-rose-600",
    };
  }
  return {
    icon: <FileText className="size-4" />,
    tint: "bg-slate-50 text-slate-600",
  };
}

export function RecentDocuments({ docs }: { docs: DashboardRecentDocument[] }) {
  if (docs.length === 0) return null;
  return (
    <Card
      className={cn(
        "p-5 lg:p-6 rounded-3xl border-slate-200/70 bg-white",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-14px_rgba(15,23,42,0.10)]"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[14.5px] font-semibold tracking-tight text-slate-900">
            Recent documents
          </h3>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Labs, prescriptions and consent forms
          </p>
        </div>
        <button className="text-[12px] font-semibold text-primary hover:underline">
          View all
        </button>
      </div>
      <ul className="space-y-2">
        {docs.map((d, i) => {
          const s = categoryStyle(d.category);
          // Visual-only AI summary indicator — wire to backend later.
          const hasAISummary = i % 2 === 0;
          return (
            <li
              key={d.id}
              className="group flex items-center gap-3 rounded-2xl border border-slate-100 hover:border-slate-200 px-3 py-2.5 transition-all hover:shadow-sm bg-white"
            >
              <div
                className={cn(
                  "size-10 rounded-xl grid place-items-center shrink-0",
                  s.tint
                )}
              >
                {s.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-900 truncate">
                    {d.name}
                  </span>
                  {hasAISummary && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-600 px-1.5 py-0.5 text-[10px] font-semibold shrink-0">
                      <Sparkles className="size-2.5" />
                      AI summary
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 capitalize">
                  {d.category} · {formatDate(d.created_at)}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  className="size-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 grid place-items-center transition"
                  onClick={() => toast.info("Download — coming soon")}
                  aria-label="Download"
                >
                  <Download className="size-3.5" />
                </button>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => toast.info("Documents — coming soon")}
                >
                  Preview
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
