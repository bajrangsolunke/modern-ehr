import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TaskItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  tint: string;
  urgent?: boolean;
  done?: boolean;
}

const SAMPLE_TASKS: TaskItem[] = [
  {
    id: "intake",
    title: "Complete intake form",
    icon: <ClipboardList className="size-3.5" />,
    tint: "bg-primary/10 text-primary",
    urgent: true,
  },
  {
    id: "insurance",
    title: "Upload insurance card",
    icon: <CreditCard className="size-3.5" />,
    tint: "bg-amber-50 text-amber-600",
  },
  {
    id: "labs",
    title: "Review lab results",
    icon: <FileText className="size-3.5" />,
    tint: "bg-violet-50 text-violet-600",
    done: true,
  },
  {
    id: "confirm",
    title: "Confirm appointment",
    icon: <CheckCircle2 className="size-3.5" />,
    tint: "bg-emerald-50 text-emerald-600",
  },
];

interface Props {
  total: number;
  forms: number;
  tasks: number;
}

export function TasksWidget({ total, forms, tasks }: Props) {
  const navigate = useNavigate();
  const done = SAMPLE_TASKS.filter((t) => t.done).length;
  const progress = Math.round((done / SAMPLE_TASKS.length) * 100);

  return (
    <Card
      className={cn(
        "p-5 rounded-3xl border-slate-200/70 bg-white flex flex-col gap-4",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-14px_rgba(15,23,42,0.10)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "size-8 rounded-xl grid place-items-center shrink-0",
                total > 0
                  ? "bg-warning/15 text-warning"
                  : "bg-success/15 text-success"
              )}
            >
              {total > 0 ? (
                <ClipboardList className="size-4" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
            </div>
            <h3 className="text-[13px] font-semibold tracking-tight text-slate-900">
              Things to do
            </h3>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[22px] font-bold tabular-nums text-slate-900">
              {total > 0 ? total : "0"}
            </span>
            <span className="text-[12px] text-slate-500">
              {total > 0
                ? `open · ${forms} ${forms === 1 ? "form" : "forms"} · ${tasks} ${tasks === 1 ? "task" : "tasks"}`
                : "All caught up"}
            </span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-600 px-2 py-0.5 text-[10px] font-bold">
          <Sparkles className="size-2.5" />
          AI sorted
        </span>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
          <span>This week</span>
          <span className="font-semibold text-slate-700 tabular-nums">{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-[#7AB2FF] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Task list preview */}
      <ul className="space-y-1.5">
        {SAMPLE_TASKS.slice(0, 3).map((t) => (
          <li
            key={t.id}
            className={cn(
              "flex items-center gap-2.5 px-2 py-2 rounded-xl transition",
              t.done ? "opacity-50" : "hover:bg-slate-50"
            )}
          >
            <span
              className={cn(
                "size-6 rounded-lg grid place-items-center shrink-0",
                t.tint
              )}
            >
              {t.icon}
            </span>
            <span
              className={cn(
                "text-[12.5px] flex-1 truncate",
                t.done
                  ? "text-slate-400 line-through"
                  : "text-slate-700 font-medium"
              )}
            >
              {t.title}
            </span>
            {t.urgent && !t.done && (
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wide shrink-0">
                Due
              </span>
            )}
          </li>
        ))}
      </ul>

      <Button
        size="sm"
        variant={total > 0 ? "default" : "secondary"}
        onClick={() => navigate("/tasks")}
        className="self-start"
      >
        {total > 0 ? "Open your list" : "Go to Tasks"}
      </Button>
    </Card>
  );
}
