import {
  Activity,
  ClipboardList,
  FileText,
  FlaskConical,
  ScanLine,
  Stethoscope,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeline } from "@/data/mock";
import { formatDate } from "@/lib/utils";

const iconMap = {
  encounter: Stethoscope,
  procedure: Activity,
  lab: FlaskConical,
  imaging: ScanLine,
  note: FileText,
  medication: ClipboardList,
};

const colorMap: Record<string, string> = {
  encounter: "bg-primary/10 text-primary",
  procedure: "bg-violet-100 text-violet-700",
  lab: "bg-amber-100 text-amber-700",
  imaging: "bg-sky-100 text-sky-700",
  note: "bg-emerald-100 text-emerald-700",
  medication: "bg-rose-100 text-rose-700",
};

export function Timeline() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Medical timeline</CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        <div className="relative pl-6">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
          {timeline.map((t) => {
            const Icon = iconMap[t.type];
            return (
              <div key={t.id} className="relative pb-4 last:pb-0">
                <div
                  className={`absolute -left-3 size-6 rounded-full ring-4 ring-card grid place-items-center ${colorMap[t.type]}`}
                >
                  <Icon className="size-3" />
                </div>
                <div className="ml-6 rounded-xl border border-border/60 bg-surface-subtle p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">{t.title}</h4>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(t.date)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">
                    {t.detail}
                  </p>
                  {t.author && (
                    <p className="text-[11px] text-muted-foreground/80 mt-1">
                      {t.author}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
