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
        {/*
          Centering: we use a flex wrapper, not -translate-x/-y on the
          Content itself. tailwindcss-animate's `animate-in` keyframe
          overwrites the element's transform during the animation, so
          translate-based centering causes a brief off-center frame
          before snapping back. Flex centering keeps position stable
          across the whole animation.
        */}
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-200"
          )}
        />
        <div className="fixed inset-0 z-50 grid place-items-center p-4 pointer-events-none">
          <Dialog.Content
            className={cn(
              "pointer-events-auto w-full max-w-md rounded-2xl bg-white shadow-elev border border-border p-6 focus:outline-none",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "duration-200"
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
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
