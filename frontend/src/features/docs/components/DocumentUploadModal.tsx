import { useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  FileUp,
  Loader2,
  Search,
  UploadCloud,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { UserAvatar } from "@/components/ui/avatar";
import { useUploadDocument } from "@/features/docs/hooks/use-documents";
import { usePatients } from "@/features/patients/hooks/use-patients";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { CATEGORY_LABEL } from "@/features/docs/categories";
import type { DocCategory } from "@/features/docs/api/docs-api";
import { cn, formatBytes } from "@/lib/utils";

const MAX_BYTES = 25 * 1024 * 1024;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPatientId?: string;
}

export function DocumentUploadModal({
  open,
  onOpenChange,
  defaultPatientId,
}: Props) {
  const upload = useUploadDocument();
  const [patientId, setPatientId] = useState<string>(defaultPatientId ?? "");
  const [category, setCategory] = useState<DocCategory>("other");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSubmit = Boolean(patientId && file && file.size <= MAX_BYTES);

  const handleSubmit = async () => {
    if (!canSubmit || !file) return;
    await upload.mutateAsync({ patientId, category, file });
    onOpenChange(false);
    setFile(null);
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Upload document"
      description="Attach a file to a patient's chart. PDFs, images, text — up to 25 MB."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={upload.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || upload.isPending}
          >
            {upload.isPending && <Loader2 className="size-4 animate-spin" />}
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Section title="1 · Patient" required>
          <PatientPicker value={patientId} onChange={setPatientId} />
        </Section>

        <Section title="2 · Category">
          <CategoryPicker value={category} onChange={setCategory} />
        </Section>

        <Section title="3 · File" required>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border bg-surface-subtle hover:border-foreground/30"
            )}
          >
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <FilePreview
                file={file}
                onClear={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
            ) : (
              <EmptyDropzone />
            )}
          </div>
          {file && file.size > MAX_BYTES && (
            <div className="text-xs text-danger mt-2">
              File is {formatBytes(file.size)}. Max upload is 25 MB.
            </div>
          )}
        </Section>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */

function PatientPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(query, 200);

  const { data: results } = usePatients({
    q: debounced || undefined,
    page: 1,
    page_size: 8,
  });
  const selected = useMemo(
    () => results?.items.find((p) => p.id === value) ?? null,
    [results, value]
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-full border border-border bg-white px-3 h-10 text-left shadow-soft ring-focus"
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <UserAvatar
              name={selected.name}
              src={selected.avatarUrl}
              size="sm"
            />
            <span className="text-sm font-medium truncate">{selected.name}</span>
            <span className="text-xs text-muted-foreground">
              MRN {selected.mrn}
            </span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Pick a patient…</span>
        )}
        <ChevronDown className="size-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-2xl border border-border bg-white shadow-elev p-2 animate-fade-in">
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or MRN…"
              className="w-full h-9 rounded-full border border-border bg-white pl-9 pr-3 text-sm ring-focus"
            />
          </div>
          <div className="max-h-64 overflow-y-auto mt-2">
            {(results?.items ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground px-3 py-4 text-center">
                No matches.
              </div>
            )}
            {results?.items.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-2 rounded-xl hover:bg-surface-subtle text-left",
                  value === p.id && "bg-surface-subtle"
                )}
              >
                <UserAvatar name={p.name} src={p.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    MRN {p.mrn} · {p.procedure || "—"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryPicker({
  value,
  onChange,
}: {
  value: DocCategory;
  onChange: (c: DocCategory) => void;
}) {
  const entries = Object.entries(CATEGORY_LABEL) as [DocCategory, string][];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {entries.map(([key, label]) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={active}
            className={cn(
              "h-9 rounded-xl border text-sm font-medium transition ring-focus",
              active
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-white text-foreground hover:border-foreground/30"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Section({
  title,
  required,
  children,
}: {
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <FormField label={title} required={required}>
      {children}
    </FormField>
  );
}

function EmptyDropzone() {
  return (
    <div className="flex flex-col items-center gap-2 text-muted-foreground">
      <div className="size-10 rounded-2xl bg-white grid place-items-center">
        <UploadCloud className="size-5" />
      </div>
      <div className="text-sm font-semibold text-foreground">
        Drop a file or click to browse
      </div>
      <div className="text-xs">PDF, image, or text · up to 25 MB</div>
    </div>
  );
}

function FilePreview({
  file,
  onClear,
}: {
  file: File;
  onClear: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl p-3 text-left border border-border">
      <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
        <FileUp className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{file.name}</div>
        <div className="text-[11px] text-muted-foreground">
          {file.type || "unknown type"} · {formatBytes(file.size)}
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="size-7 rounded-full grid place-items-center hover:bg-secondary"
        aria-label="Remove selection"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
