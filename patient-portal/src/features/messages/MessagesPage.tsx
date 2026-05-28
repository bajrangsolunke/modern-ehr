import { MessageCircle } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export function MessagesPage() {
  return (
    <PlaceholderPage
      title="Communication"
      description="Secure messages between you and your care team."
      icon={<MessageCircle />}
    />
  );
}
