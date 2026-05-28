import { CheckCircle2, ListTodo } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import type { DashboardPendingActions } from "@/features/dashboard/api/dashboard-api";

export function Actions({ data }: { data: DashboardPendingActions }) {
  if (data.total === 0) {
    return (
      <Card className="border-primary/20 bg-primary-soft/40">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-6 text-primary" />
          <div>
            <div className="font-semibold text-foreground">
              You're all caught up
            </div>
            <div className="text-sm text-muted">No pending actions right now.</div>
          </div>
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="size-12 rounded-full bg-warning/10 text-warning grid place-items-center shrink-0">
          <ListTodo className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-muted font-semibold mb-1">
            Things to do
          </div>
          <div className="text-lg font-bold">
            You have {data.total} {data.total === 1 ? "item" : "items"}
          </div>
          <div className="text-sm text-muted mt-0.5">
            {data.forms_count} {data.forms_count === 1 ? "form" : "forms"} ·{" "}
            {data.tasks_count} {data.tasks_count === 1 ? "task" : "tasks"}
          </div>
          <div className="mt-4">
            <Button
              size="md"
              onClick={() => toast.info("Your to-do list — coming soon")}
            >
              View list
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
