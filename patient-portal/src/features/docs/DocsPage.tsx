import { Download, FileText, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Empty } from "@/components/ui/empty";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SortableTh, TABLE_ROW_BG } from "@/components/ui/sortable-th";
import { useDocuments } from "./hooks/use-documents";
import { docsApi, type PatientDocument } from "./api/docs-api";
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

const CATEGORY_TONE: Record<
  string,
  "info" | "success" | "warning" | "neutral" | "default"
> = {
  consent: "warning",
  imaging: "info",
  lab: "success",
  insurance: "default",
  referral: "info",
  discharge: "neutral",
  general: "neutral",
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
        <>
          {data.items.length === 0 ? (
            <Empty
              icon={<FileText className="size-5" />}
              title="No documents yet"
              description="Records shared by your care team will appear here."
            />
          ) : (
            <DocsTable items={data.items} />
          )}
        </>
      )}
    </>
  );
}

function DocsTable({ items }: { items: PatientDocument[] }) {
  return (
    <Card className="overflow-hidden p-3 sm:p-4">
      <div className="overflow-x-auto">
        <table
          className="w-full text-sm border-separate"
          style={{ borderSpacing: "0 6px" }}
        >
          <thead>
            <tr className="text-xs text-muted-foreground text-left">
              <SortableTh first>Document</SortableTh>
              <SortableTh>Category</SortableTh>
              <SortableTh>Uploaded by</SortableTh>
              <SortableTh>Uploaded</SortableTh>
              <SortableTh last>{""}</SortableTh>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <DocsRow key={d.id} doc={d} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DocsRow({ doc }: { doc: PatientDocument }) {
  return (
    <tr className="hover:[&_td]:bg-[#EEF2F8] transition">
      <td
        className="px-4 py-2 first:rounded-l-full"
        style={{ background: TABLE_ROW_BG }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{doc.name}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {doc.mime_type} · {formatBytes(doc.size_bytes)}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2" style={{ background: TABLE_ROW_BG }}>
        <Badge variant={CATEGORY_TONE[doc.category] ?? "neutral"} size="sm">
          {CATEGORY_LABEL[doc.category] ?? doc.category}
        </Badge>
      </td>
      <td className="px-4 py-2 text-foreground/80" style={{ background: TABLE_ROW_BG }}>
        {doc.uploaded_by ?? (
          <span className="text-muted-foreground italic">—</span>
        )}
      </td>
      <td
        className="px-4 py-2 text-foreground/80 tabular-nums"
        style={{ background: TABLE_ROW_BG }}
      >
        {formatDate(doc.created_at)}
      </td>
      <td
        className="px-4 py-2 last:rounded-r-full text-right"
        style={{ background: TABLE_ROW_BG }}
      >
        <Button size="sm" variant="secondary" onClick={() => docsApi.open(doc.id)}>
          <Download className="size-4" />
          Open
        </Button>
      </td>
    </tr>
  );
}
