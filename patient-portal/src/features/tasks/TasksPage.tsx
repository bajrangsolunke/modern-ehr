import { ListTodo } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Empty } from "@/components/ui/empty";

export function TasksPage() {
  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Forms, follow-ups, and to-dos from your care team."
      />
      <Empty
        icon={<ListTodo className="size-5" />}
        title="Tasks — coming soon"
        description="Action items from your providers — forms to complete, follow-up reminders, and care-plan steps."
      />
    </>
  );
}
