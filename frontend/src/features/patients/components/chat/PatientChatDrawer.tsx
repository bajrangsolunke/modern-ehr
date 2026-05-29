/**
 * PatientChatWidget — floating chat widget (Intercom / ChatGPT style).
 *
 * Replaces the previous full-height Drawer with a compact panel
 * anchored to the bottom-right corner. Opens above the FAB, ~400px
 * wide x ~620px tall, with a branded header, close button, and the
 * chat thread filling the body.
 *
 * File name kept as PatientChatDrawer.tsx for git history continuity,
 * but the component is now a positioned panel — not a Radix Drawer.
 */
import { useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PatientChatThread } from "./PatientChatThread";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

export function PatientChatDrawer({
  open,
  onOpenChange,
  patientId,
  patientName,
}: Props) {
  // Escape to close — matches dialog/drawer behavior the user expects.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed bottom-24 right-6 z-40 w-[400px] max-w-[calc(100vw-2rem)] h-[620px] max-h-[calc(100vh-8rem)] rounded-2xl bg-white shadow-elev border border-border flex flex-col overflow-hidden"
          role="dialog"
          aria-label={`Ask AI about ${patientName}`}
        >
          {/* Branded header */}
          <header className="shrink-0 px-4 py-3 bg-primary-gradient text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-9 rounded-full bg-white/15 grid place-items-center shrink-0">
                <Sparkles className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">
                  Ask about {patientName}
                </div>
                <div className="text-[11px] text-white/80 truncate">
                  AI chart Q&amp;A · cites the source
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close chat"
              className="size-8 rounded-full grid place-items-center hover:bg-white/15 transition shrink-0"
            >
              <X className="size-4" />
            </button>
          </header>

          {/* Body: thread fills remaining space, composer sticks to bottom */}
          <div className="flex-1 min-h-0 flex flex-col px-3 pt-3 pb-3 bg-surface-subtle/30">
            <PatientChatThread patientId={patientId} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
