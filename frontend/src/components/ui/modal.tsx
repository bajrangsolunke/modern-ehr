import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
  className?: string;
}

const sizes = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

/**
 * Centered modal dialog. Same Radix Dialog foundation as Drawer but
 * positioned in the middle of the viewport. Use for guided multi-step
 * forms (e.g. appointment booking) where a side drawer would feel too
 * peripheral.
 *
 * Centering uses a flex wrapper, not a transform — that way the
 * tailwindcss-animate `animate-in` keyframe (which rewrites
 * `transform`) can't fight the centering and produce a glitch frame.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  footer,
  size = "md",
  children,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
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
              "pointer-events-auto w-full rounded-2xl bg-[#F5F9FF] shadow-elev border border-border max-h-[92vh] flex flex-col focus:outline-none",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "duration-200",
              sizes[size],
              className
            )}
          >
            <div className="flex items-start justify-between gap-4 px-6 py-4 bg-white border-b border-border rounded-t-2xl shrink-0">
              <div className="min-w-0">
                <Dialog.Title className="text-lg font-bold tracking-tight truncate">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="text-sm text-muted-foreground mt-0.5">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close
                className="size-9 rounded-full grid place-items-center bg-[#F1F4F9] hover:bg-[#E6EBF2] text-slate-700 shrink-0 ring-focus"
                aria-label="Close"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

            {footer && (
              <div className="border-t border-border bg-white px-6 py-3 shrink-0 rounded-b-2xl">
                {footer}
              </div>
            )}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
