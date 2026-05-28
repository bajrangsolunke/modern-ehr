import { useMemo, useState } from "react";
import {
  ClipboardList,
  Download,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Empty } from "@/components/ui/empty";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SortableTh, TABLE_ROW_BG } from "@/components/ui/sortable-th";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  FilterPopover,
  FilterHeader,
  FilterGroup,
} from "@/components/ui/filter-popover";
import { FilterChip } from "@/components/ui/filter-chip";
import { useDocuments } from "./hooks/use-documents";
import { useForms } from "@/features/forms/hooks/use-forms";
import { docsApi, type PatientDocument } from "./api/docs-api";
import { UploadDocumentModal } from "./components/UploadDocumentModal";
import { FormFillModal } from "@/features/tasks/components/FormFillModal";
import { formatBytes, formatDate } from "@/lib/utils";
import type { PatientFormRequest } from "@/features/forms/api/forms-api";

const CATEGORY_LABEL: Record<string, string> = {
  general: "General",
  consent: "Consent",
  imaging: "Imaging",
  lab: "Lab",
  insurance: "Insurance",
  referral: "Referral",
  discharge: "Discharge",
};
const CATEGORY_KEYS = Object.keys(CATEGORY_LABEL);

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

const FORM_LABEL: Record<string, string> = {
  consent: "Consent form",
  intake: "Intake form",
  roi: "Release of information",
  insurance: "Insurance details",
  discharge: "Discharge form",
  referral: "Referral form",
};

const FORM_STATUS_VARIANT: Record<
  string,
  "info" | "success" | "warning" | "neutral" | "danger" | "default"
> = {
  pending: "warning",
  submitted: "info",
  completed: "success",
  denied: "danger",
};

type Source = "any" | "you" | "team";
type DateRange = "any" | "7d" | "30d" | "90d";

export function DocsPage() {
  const docs = useDocuments();
  const forms = useForms();
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Documents filters
  const [docCategory, setDocCategory] = useState<string | undefined>();
  const [docSource, setDocSource] = useState<Source>("any");
  const [docRange, setDocRange] = useState<DateRange>("any");

  // Forms filters
  const [formStatus, setFormStatus] = useState<string | undefined>();
  const [formType, setFormType] = useState<string | undefined>();

  const filteredDocs = useMemo(() => {
    const items = docs.data?.items ?? [];
    const cutoffMs =
      docRange === "7d"
        ? Date.now() - 7 * 86_400_000
        : docRange === "30d"
          ? Date.now() - 30 * 86_400_000
          : docRange === "90d"
            ? Date.now() - 90 * 86_400_000
            : null;
    return items.filter((d) => {
      if (docCategory && d.category !== docCategory) return false;
      if (docSource === "you" && !d.uploaded_by?.startsWith("patient:"))
        return false;
      if (docSource === "team" && d.uploaded_by?.startsWith("patient:"))
        return false;
      if (cutoffMs !== null && new Date(d.created_at).getTime() < cutoffMs)
        return false;
      return true;
    });
  }, [docs.data, docCategory, docSource, docRange]);

  const filteredForms = useMemo(() => {
    const items = forms.data?.items ?? [];
    return items.filter((f) => {
      if (formStatus && f.status !== formStatus) return false;
      if (formType && f.form_type !== formType) return false;
      return true;
    });
  }, [forms.data, formStatus, formType]);

  const docActiveCount =
    (docCategory ? 1 : 0) +
    (docSource !== "any" ? 1 : 0) +
    (docRange !== "any" ? 1 : 0);

  const formActiveCount = (formStatus ? 1 : 0) + (formType ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Forms to complete and records shared with you."
      />

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">
            Documents · {docs.data?.total ?? 0}
          </TabsTrigger>
          <TabsTrigger value="forms">
            Forms · {forms.data?.items.length ?? 0}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Records shared by your care team — plus anything you upload.
            </p>
            <div className="flex items-center gap-2">
              <FilterPopover
                activeCount={docActiveCount}
                renderBody={(close) => (
                  <>
                    <FilterHeader
                      onClear={() => {
                        setDocCategory(undefined);
                        setDocSource("any");
                        setDocRange("any");
                        close();
                      }}
                    />
                    <FilterGroup label="Category">
                      <FilterChip
                        label="Any"
                        active={!docCategory}
                        onClick={() => setDocCategory(undefined)}
                      />
                      {CATEGORY_KEYS.map((k) => (
                        <FilterChip
                          key={k}
                          label={CATEGORY_LABEL[k]}
                          active={docCategory === k}
                          onClick={() =>
                            setDocCategory(docCategory === k ? undefined : k)
                          }
                        />
                      ))}
                    </FilterGroup>
                    <FilterGroup label="Source">
                      <FilterChip
                        label="Any"
                        active={docSource === "any"}
                        onClick={() => setDocSource("any")}
                      />
                      <FilterChip
                        label="You uploaded"
                        active={docSource === "you"}
                        onClick={() => setDocSource("you")}
                      />
                      <FilterChip
                        label="Care team"
                        active={docSource === "team"}
                        onClick={() => setDocSource("team")}
                      />
                    </FilterGroup>
                    <FilterGroup label="Uploaded">
                      <FilterChip
                        label="Any time"
                        active={docRange === "any"}
                        onClick={() => setDocRange("any")}
                      />
                      <FilterChip
                        label="Last 7 days"
                        active={docRange === "7d"}
                        onClick={() => setDocRange("7d")}
                      />
                      <FilterChip
                        label="Last 30 days"
                        active={docRange === "30d"}
                        onClick={() => setDocRange("30d")}
                      />
                      <FilterChip
                        label="Last 90 days"
                        active={docRange === "90d"}
                        onClick={() => setDocRange("90d")}
                      />
                    </FilterGroup>
                  </>
                )}
              />
              <Button onClick={() => setUploadOpen(true)}>
                <Upload className="size-4" />
                Upload
              </Button>
            </div>
          </div>

          {docs.isLoading && <Loader />}

          {docs.isError && !docs.isLoading && (
            <ErrorBanner
              title="Couldn't load documents"
              message={docs.error instanceof Error ? docs.error.message : ""}
              onRetry={() => docs.refetch()}
              retrying={docs.isFetching}
            />
          )}

          {!docs.isLoading && !docs.isError && docs.data && (
            filteredDocs.length === 0 ? (
              <Empty
                icon={<FileText className="size-5" />}
                title={
                  docActiveCount > 0
                    ? "No documents match these filters"
                    : "No documents yet"
                }
                description={
                  docActiveCount > 0
                    ? "Try widening the filters or clearing them."
                    : "Upload a record above or wait for your care team to share one."
                }
              />
            ) : (
              <DocsTable items={filteredDocs} />
            )
          )}
        </TabsContent>

        <TabsContent value="forms">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Forms requested by your care team — fill them out here.
            </p>
            <FilterPopover
              activeCount={formActiveCount}
              renderBody={(close) => (
                <>
                  <FilterHeader
                    onClear={() => {
                      setFormStatus(undefined);
                      setFormType(undefined);
                      close();
                    }}
                  />
                  <FilterGroup label="Status">
                    <FilterChip
                      label="Any"
                      active={!formStatus}
                      onClick={() => setFormStatus(undefined)}
                    />
                    {(
                      ["pending", "submitted", "completed", "denied"] as const
                    ).map((s) => (
                      <FilterChip
                        key={s}
                        label={s}
                        active={formStatus === s}
                        onClick={() =>
                          setFormStatus(formStatus === s ? undefined : s)
                        }
                      />
                    ))}
                  </FilterGroup>
                  <FilterGroup label="Type">
                    <FilterChip
                      label="Any"
                      active={!formType}
                      onClick={() => setFormType(undefined)}
                    />
                    {Object.entries(FORM_LABEL).map(([k, v]) => (
                      <FilterChip
                        key={k}
                        label={v}
                        active={formType === k}
                        onClick={() =>
                          setFormType(formType === k ? undefined : k)
                        }
                      />
                    ))}
                  </FilterGroup>
                </>
              )}
            />
          </div>

          {forms.isLoading && <Loader />}

          {forms.isError && !forms.isLoading && (
            <ErrorBanner
              title="Couldn't load forms"
              message={forms.error instanceof Error ? forms.error.message : ""}
              onRetry={() => forms.refetch()}
              retrying={forms.isFetching}
            />
          )}

          {!forms.isLoading && !forms.isError && forms.data && (
            filteredForms.length === 0 ? (
              <Empty
                icon={<ClipboardList className="size-5" />}
                title={
                  formActiveCount > 0
                    ? "No forms match these filters"
                    : "No forms requested"
                }
                description={
                  formActiveCount > 0
                    ? "Try widening the filters or clearing them."
                    : "When your care team asks you to fill out a form, it'll appear here."
                }
              />
            ) : (
              <FormsTable items={filteredForms} onOpen={setActiveFormId} />
            )
          )}
        </TabsContent>
      </Tabs>

      <UploadDocumentModal open={uploadOpen} onOpenChange={setUploadOpen} />
      <FormFillModal formId={activeFormId} onClose={() => setActiveFormId(null)} />
    </>
  );
}

function Loader() {
  return (
    <div className="grid place-items-center py-16">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
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
              <SortableTh>Source</SortableTh>
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
  const isPatientUpload = doc.uploaded_by?.startsWith("patient:") ?? false;
  const sourceLabel = isPatientUpload
    ? doc.uploaded_by!.replace(/^patient:/, "")
    : doc.uploaded_by ?? "Care team";
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
        <div className="flex items-center gap-2">
          <span className="truncate">{sourceLabel}</span>
          {isPatientUpload && (
            <Badge variant="info" size="sm">
              You uploaded
            </Badge>
          )}
        </div>
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

function FormsTable({
  items,
  onOpen,
}: {
  items: PatientFormRequest[];
  onOpen: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden p-3 sm:p-4">
      <div className="overflow-x-auto">
        <table
          className="w-full text-sm border-separate"
          style={{ borderSpacing: "0 6px" }}
        >
          <thead>
            <tr className="text-xs text-muted-foreground text-left">
              <SortableTh first>Form</SortableTh>
              <SortableTh>Status</SortableTh>
              <SortableTh>Requested by</SortableTh>
              <SortableTh>Due</SortableTh>
              <SortableTh last>{""}</SortableTh>
            </tr>
          </thead>
          <tbody>
            {items.map((f) => (
              <FormRow key={f.id} form={f} onOpen={() => onOpen(f.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function FormRow({
  form,
  onOpen,
}: {
  form: PatientFormRequest;
  onOpen: () => void;
}) {
  const ctaLabel =
    form.status === "completed" || form.status === "denied"
      ? "View"
      : form.status === "submitted"
        ? "Review"
        : "Fill out";
  const Icon =
    form.status === "completed" || form.status === "denied" ? Plus : Pencil;
  return (
    <tr className="hover:[&_td]:bg-[#EEF2F8] transition">
      <td
        className="px-4 py-2 first:rounded-l-full"
        style={{ background: TABLE_ROW_BG }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-xl bg-warning/10 text-warning grid place-items-center shrink-0">
            <ClipboardList className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">
              {FORM_LABEL[form.form_type] ?? form.form_type}
            </div>
            {form.notes && (
              <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                {form.notes}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2" style={{ background: TABLE_ROW_BG }}>
        <Badge
          variant={FORM_STATUS_VARIANT[form.status] ?? "neutral"}
          size="sm"
        >
          {form.status}
        </Badge>
      </td>
      <td className="px-4 py-2 text-foreground/80" style={{ background: TABLE_ROW_BG }}>
        {form.requested_by ?? (
          <span className="text-muted-foreground italic">Care team</span>
        )}
      </td>
      <td
        className="px-4 py-2 text-foreground/80 tabular-nums"
        style={{ background: TABLE_ROW_BG }}
      >
        {form.due_date ? formatDate(form.due_date) : (
          <span className="text-muted-foreground italic">—</span>
        )}
      </td>
      <td
        className="px-4 py-2 last:rounded-r-full text-right"
        style={{ background: TABLE_ROW_BG }}
      >
        <Button size="sm" variant="secondary" onClick={onOpen}>
          <Icon className="size-4" />
          {ctaLabel}
        </Button>
      </td>
    </tr>
  );
}
