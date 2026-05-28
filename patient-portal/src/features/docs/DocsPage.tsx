import { FileText } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export function DocsPage() {
  return (
    <PlaceholderPage
      title="Documents"
      description="Your shared records, forms, and uploads."
      icon={<FileText />}
    />
  );
}
