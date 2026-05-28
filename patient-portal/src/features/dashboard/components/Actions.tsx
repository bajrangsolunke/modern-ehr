import { CheckCircle2, ListTodo } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import type { DashboardPendingActions } from "@/features/dashboard/api/dashboard-api";

export function Actions({ data }: { data: DashboardPendingActions }) {
  if (data.total === 0) {
    return (
      <Card className="p-6 border-primary/30 bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-primary/15 text-primary grid place-items-center">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <div className="font-semibold text-foreground">You're all caught up</div>
            <div className="text-sm text-muted-foreground">
              No pending actions right now.
            </div>
          </div>
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="size-12 rounded-2xl bg-warning/10 text-warning grid place-items-center shrink-0">
          <ListTodo className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Things to do
          </div>
          <div className="text-lg font-bold">
            You have {data.total} {data.total === 1 ? "item" : "items"}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {data.forms_count} {data.forms_count === 1 ? "form" : "forms"} ·{" "}
            {data.tasks_count} {data.tasks_count === 1 ? "task" : "tasks"}
          </div>
          <div className="mt-4">
            <Button
              size="sm"
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
