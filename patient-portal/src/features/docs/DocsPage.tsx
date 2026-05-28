import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Empty } from "@/components/ui/empty";

export function DocsPage() {
  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Your shared records, forms, and uploads."
      />
      <Empty
        icon={<FileText className="size-5" />}
        title="Documents — coming soon"
        description="Records shared by your care team and forms you've submitted will appear here."
      />
    </>
  );
}
