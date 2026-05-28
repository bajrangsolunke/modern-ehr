import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Empty } from "@/components/ui/empty";

export function MessagesPage() {
  return (
    <>
      <PageHeader
        title="Communication"
        subtitle="Secure messages between you and your care team."
      />
      <Empty
        icon={<MessageSquare className="size-5" />}
        title="Messages — coming soon"
        description="You'll see conversations with your providers, attachments, and broadcasts from your care team here."
      />
    </>
  );
}
