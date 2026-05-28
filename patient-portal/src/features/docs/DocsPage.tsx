import { FileText, Loader2, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Empty } from "@/components/ui/empty";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDocuments } from "./hooks/use-documents";
import { docsApi } from "./api/docs-api";
import { formatBytes, formatDate } from "@/lib/utils";

const CATEGORY_LABEL: Record<string, string> = {
  consent: "Consent",
  imaging: "Imaging",
  lab: "Lab",
  insurance: "Insurance",
  referral: "Referral",
  discharge: "Discharge",
  general: "General",
};

export function DocsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useDocuments();

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Records and uploads your care team has shared with you."
      />

      {isLoading && (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load documents"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && data && (
        <div className="max-w-3xl">
          {data.items.length === 0 ? (
            <Empty
              icon={<FileText className="size-5" />}
              title="No documents yet"
              description="Records shared by your care team will appear here."
            />
          ) : (
            <Card className="divide-y divide-border">
              {data.items.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{doc.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {CATEGORY_LABEL[doc.category] ?? doc.category} ·{" "}
                      {formatBytes(doc.size_bytes)} · {formatDate(doc.created_at)}
                      {doc.uploaded_by && <> · uploaded by {doc.uploaded_by}</>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => docsApi.open(doc.id)}
                  >
                    <Download className="size-4" />
                    Open
                  </Button>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </>
  );
}
