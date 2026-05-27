import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import { usePatientDocuments } from "@/features/docs/hooks/use-documents";
import { categoryLabel, CATEGORY_TONE } from "@/features/docs/categories";
import { Badge } from "@/components/ui/badge";
import { cn, formatBytes } from "@/lib/utils";
import type { Document } from "@/features/docs/api/docs-api";

interface Props {
  patientId: string;
  selectedIds: Set<string>;
  onToggle: (doc: Document) => void;
  disabled?: boolean;
}

/**
 * Paperclip → popover lister of every document already on the
 * patient's chart. Check to attach; selection accumulates and is
 * sent with the next message.
 */
export function AttachmentPicker({
  patientId,
  selectedIds,
  onToggle,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const { data: docs = [], isLoading } = usePatientDocuments(
    open ? patientId : undefined
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Attach document"
          className={cn(
            "size-10 shrink-0 rounded-full grid place-items-center transition ring-focus",
            selectedIds.size > 0
              ? "bg-primary/10 text-primary"
              : "bg-surface-subtle text-muted-foreground hover:bg-secondary hover:text-foreground",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <Paperclip className="size-4" />
          {selectedIds.size > 0 && (
            <span className="absolute -top-1 -right-1 inline-grid place-items-center size-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold ring-2 ring-white">
              {selectedIds.size}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[min(92vw,360px)] rounded-2xl bg-white shadow-elev border border-border p-3 animate-fade-in"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold">Attach from chart</h3>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {selectedIds.size} selected
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto -mx-1 px-1">
            {isLoading && (
              <div className="text-xs text-muted-foreground text-center py-6">
                Loading…
              </div>
            )}
            {!isLoading && docs.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-6">
                No documents on file yet. Upload from the Documents page.
              </div>
            )}
            <ul className="space-y-1">
              {docs.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(d)}
                    className={cn(
                      "w-full text-left rounded-xl px-2.5 py-2 transition ring-focus flex items-start gap-2.5",
                      selectedIds.has(d.id)
                        ? "bg-primary/5 ring-1 ring-primary/30"
                        : "hover:bg-surface-subtle"
                    )}
                  >
                    <Glyph mime={d.mimeType} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">
                        {d.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Badge
                          variant={CATEGORY_TONE[d.category as never] ?? "neutral"}
                          size="sm"
                        >
                          {categoryLabel(d.category)}
                        </Badge>
                        <span>{formatBytes(d.sizeBytes)}</span>
                      </div>
                    </div>
                    {selectedIds.has(d.id) && (
                      <Check className="size-4 text-primary shrink-0 mt-0.5" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Glyph({ mime }: { mime: string }) {
  const isImage = mime.startsWith("image/");
  return (
    <div
      className={cn(
        "size-8 rounded-lg grid place-items-center shrink-0 [&_svg]:size-3.5",
        isImage
          ? "bg-info/10 text-info"
          : mime === "application/pdf"
            ? "bg-danger/10 text-danger"
            : "bg-primary/10 text-primary"
      )}
    >
      {isImage ? <ImageIcon aria-label="" /> : <FileText />}
    </div>
  );
}
