import { ListTodo } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export function TasksPage() {
  return (
    <PlaceholderPage
      title="Tasks"
      description="Forms, follow-ups, and to-dos from your care team."
      icon={<ListTodo />}
    />
  );
}
