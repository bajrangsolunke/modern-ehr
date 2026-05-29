/**
 * Floating chat widget for the patient portal. Bottom-right FAB
 * toggles a panel just like the provider portal chat — but scoped to
 * the patient's own chart.
 */
import { useEffect, useState } from "react";
import { MessageCircle, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ChatThread } from "./ChatThread";

export function ChatWidget() {
  const [open, setOpen] = useState(false);

  // Esc to close — matches the provider portal behavior
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed bottom-24 right-6 z-40 w-[400px] max-w-[calc(100vw-2rem)] h-[620px] max-h-[calc(100vh-8rem)] rounded-2xl bg-white shadow-2xl border border-border flex flex-col overflow-hidden"
            role="dialog"
            aria-label="Chat with your care team's AI assistant"
          >
            <header className="shrink-0 px-4 py-3 bg-primary text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-9 rounded-full bg-white/15 grid place-items-center shrink-0">
                  <Sparkles className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">
                    Your care assistant
                  </div>
                  <div className="text-[11px] text-white/80 truncate">
                    Based only on your records · not medical advice
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="size-8 rounded-full grid place-items-center hover:bg-white/15 transition shrink-0"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 min-h-0 flex flex-col px-3 pt-3 pb-3 bg-surface-subtle/30">
              <ChatThread />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating FAB — always visible at the bottom-right */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Open chat with care assistant"}
        className="fixed bottom-6 right-6 z-30 size-14 rounded-full bg-primary text-white shadow-xl hover:scale-105 transition grid place-items-center"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </>
  );
}
