import { Bell } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Empty } from "@/components/ui/empty";

export function NotificationsPage() {
  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Updates from your appointments, messages, and care plan."
      />
      <Empty
        icon={<Bell className="size-5" />}
        title="Notifications — coming soon"
        description="We'll surface appointment reminders, new messages, and care-team updates here."
      />
    </>
  );
}
