import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  FileUp,
  Loader2,
  UploadCloud,
  X,
  ChevronDown,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { useUploadDocument } from "@/features/docs/hooks/use-documents";
import { cn, formatBytes } from "@/lib/utils";

const MAX_BYTES = 20 * 1024 * 1024;

const CATEGORY_LABEL: Record<string, string> = {
  general: "General",
  lab: "Lab",
  imaging: "Imaging",
  insurance: "Insurance",
  referral: "Referral",
  consent: "Consent",
  discharge: "Discharge",
};
const CATEGORY_KEYS = Object.keys(CATEGORY_LABEL);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Full upload flow in a single modal: pick file (click or drag),
 * choose a category, jot down a short description. We honor the same
 * 20 MB cap the backend enforces so users get instant feedback
 * instead of a server-side 413.
 */
export function UploadDocumentModal({ open, onOpenChange }: Props) {
  const upload = useUploadDocument();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("general");
  const [description, setDescription] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setCategory("general");
    setDescription("");
    setError(null);
    setDragOver(false);
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError(`File is too large (max ${MAX_BYTES / (1024 * 1024)} MB).`);
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    try {
      await upload.mutateAsync({ file, category });
      onOpenChange(false);
      // Reset on next open
      setTimeout(reset, 200);
    } catch {
      /* the hook already toasts */
    }
  };

  const canSubmit = !!file && !upload.isPending;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white shadow-elev border border-border max-h-[90vh] flex flex-col">
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold tracking-tight">
                Upload a document
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground mt-1">
                Share a file with your care team. PDFs, images, text — up to{" "}
                {MAX_BYTES / (1024 * 1024)} MB.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="size-9 rounded-full bg-secondary hover:bg-secondary/80 grid place-items-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <FormField label="File" required>
              <Dropzone
                file={file}
                dragOver={dragOver}
                onPick={pickFile}
                onClear={() => setFile(null)}
                onDragOver={(v) => setDragOver(v)}
                onClick={() => fileRef.current?.click()}
              />
              <input
                ref={fileRef}
                type="file"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </FormField>

            <FormField label="Category" htmlFor="upload-category" required>
              <div className="relative">
                <select
                  id="upload-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="appearance-none w-full h-10 rounded-full border border-border bg-white pl-4 pr-10 text-sm shadow-soft ring-focus"
                >
                  {CATEGORY_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {CATEGORY_LABEL[k]}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              </div>
            </FormField>

            <FormField
              label="Description"
              htmlFor="upload-description"
              hint="Optional. A short note for your care team."
            >
              <textarea
                id="upload-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-border bg-white px-4 py-2 text-sm shadow-soft ring-focus resize-none placeholder:text-muted-foreground/70"
                placeholder="e.g. Insurance card front + back"
              />
            </FormField>

            {error && (
              <div className="rounded-2xl bg-danger/10 border border-danger/30 text-danger px-3 py-2 text-sm">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={upload.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {upload.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UploadCloud className="size-4" />
              )}
              {upload.isPending ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Dropzone({
  file,
  dragOver,
  onPick,
  onClear,
  onDragOver,
  onClick,
}: {
  file: File | null;
  dragOver: boolean;
  onPick: (f: File | null) => void;
  onClear: () => void;
  onDragOver: (v: boolean) => void;
  onClick: () => void;
}) {
  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3">
        <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <FileText className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{file.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {file.type || "application/octet-stream"} · {formatBytes(file.size)}
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Remove"
          className="size-8 rounded-full bg-white border border-border grid place-items-center text-muted-foreground hover:text-danger hover:border-danger/40 transition"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(true);
      }}
      onDragLeave={() => onDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
      className={cn(
        "w-full flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition px-6 py-8 text-center ring-focus",
        dragOver
          ? "border-primary bg-primary/5"
          : "border-border bg-secondary/30 hover:border-primary/40"
      )}
    >
      <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
        <FileUp className="size-5" />
      </div>
      <div className="text-sm font-semibold">
        Click to choose a file or drag it here
      </div>
      <div className="text-[11px] text-muted-foreground">
        PDFs, images, text — up to {MAX_BYTES / (1024 * 1024)} MB
      </div>
    </button>
  );
}
