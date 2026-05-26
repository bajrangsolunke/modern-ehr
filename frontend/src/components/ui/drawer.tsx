import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerProps {
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
 * Side drawer (slide-in from the right). Built on Radix Dialog so it gets
 * focus trap, ESC to close, scroll lock, and ARIA semantics for free.
 *
 * Use for: create / quick-edit flows that shouldn't claim a full route,
 * filter panels, settings modals.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  footer,
  size = "lg",
  children,
  className,
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 z-50 h-full w-full overflow-hidden bg-[#F5F9FF] shadow-elev flex flex-col",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            "duration-200 ease-out",
            sizes[size],
            className
          )}
        >
          <div className="flex items-center justify-between gap-4 px-6 py-4 bg-white border-b border-border shrink-0">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-bold tracking-tight truncate">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-muted-foreground truncate mt-0.5">
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
            <div className="border-t border-border bg-white px-6 py-3 shrink-0">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
