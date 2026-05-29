/**
 * Floating chat widget for the patient portal. Bottom-right FAB
 * toggles a panel just like the provider portal chat — but scoped to
 * the patient's own chart.
 */
import { useEffect, useState } from "react";
import { MessageCircle, Sparkles, X } from "lucide-react";
import { ChatThread } from "./ChatThread";

export function ChatWidget() {
  // `open` controls whether the panel exists in the DOM.
  // `visible` triggers the CSS transition. We mount first (open=true)
  // then immediately flip visible=true on the next paint so the
  // transition has something to animate from. On close we flip
  // visible=false first, then unmount after the transition finishes.
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      // Next paint → kick off the enter transition
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [open]);

  // Esc to close — matches the provider portal behavior
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const handlePanelTransitionEnd = () => {
    // When the exit transition finishes (visible flipped to false),
    // remove the panel from the DOM.
    if (!visible) setOpen(false);
  };

  return (
    <>
      {open && (
        <div
          onTransitionEnd={handlePanelTransitionEnd}
          className={[
            "fixed bottom-24 right-6 z-40 w-[400px] max-w-[calc(100vw-2rem)]",
            "h-[620px] max-h-[calc(100vh-8rem)] rounded-2xl bg-white shadow-2xl",
            "border border-border flex flex-col overflow-hidden",
            "transition-all duration-200 ease-out",
            visible
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-3 scale-95",
          ].join(" ")}
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
              onClick={() => setVisible(false)}
              aria-label="Close chat"
              className="size-8 rounded-full grid place-items-center hover:bg-white/15 transition shrink-0"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="flex-1 min-h-0 flex flex-col px-3 pt-3 pb-3 bg-surface-subtle/30">
            <ChatThread />
          </div>
        </div>
      )}

      {/* Floating FAB — always visible at the bottom-right */}
      <button
        type="button"
        onClick={() => (open ? setVisible(false) : setOpen(true))}
        aria-label={open ? "Close chat" : "Open chat with care assistant"}
        className="fixed bottom-6 right-6 z-30 size-14 rounded-full bg-primary text-white shadow-xl hover:scale-105 transition grid place-items-center"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </>
  );
}
