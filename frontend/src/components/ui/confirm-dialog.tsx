import { AlertTriangle, Loader2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl bg-white shadow-elev border border-border p-6 animate-fade-in focus:outline-none"
          )}
        >
          <div className="flex items-start gap-3 mb-4">
            {destructive && (
              <div className="size-10 rounded-xl bg-danger/10 text-danger grid place-items-center shrink-0">
                <AlertTriangle className="size-5" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Dialog.Title className="text-base font-bold">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {description}
                </Dialog.Description>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Dialog.Close asChild>
              <Button variant="secondary" disabled={busy}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button
              variant={destructive ? "destructive" : "default"}
              disabled={busy}
              onClick={onConfirm}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "Working…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
