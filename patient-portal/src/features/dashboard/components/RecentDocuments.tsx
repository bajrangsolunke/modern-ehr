import { FileText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { DashboardRecentDocument } from "@/features/dashboard/api/dashboard-api";

export function RecentDocuments({ docs }: { docs: DashboardRecentDocument[] }) {
  if (docs.length === 0) return null;
  return (
    <Card>
      <div className="text-xs uppercase tracking-wider text-muted font-semibold mb-3">
        Recent documents
      </div>
      <ul className="space-y-2">
        {docs.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-3 rounded-2xl border border-border px-3 py-2"
          >
            <div className="size-9 rounded-full bg-primary-soft text-primary grid place-items-center shrink-0">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{d.name}</div>
              <div className="text-xs text-muted">
                {d.category} · {formatDate(d.created_at)}
              </div>
            </div>
            <Button
              size="md"
              variant="secondary"
              onClick={() => toast.info("Documents — coming soon")}
            >
              View
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
