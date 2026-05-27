import { useMemo, useState } from "react";
import { Search, Send } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { useMessagesStore } from "../store";
import type { Audience } from "../types";
import { cn } from "@/lib/utils";

const MAX_LEN = 160;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAudience: Audience;
}

export function ComposeMessageModal({ open, onOpenChange, defaultAudience }: Props) {
  const participants = useMessagesStore((s) => s.participants);
  const compose = useMessagesStore((s) => s.composeBroadcast);

  const [audience] = useState<Audience>(defaultAudience);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [body, setBody] = useState("");
  const [urgent, setUrgent] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return participants
      .filter((p) => p.audience === audience)
      .filter((p) =>
        q ? p.name.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q) : true
      );
  }, [participants, audience, query]);

  const allSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) visible.forEach((p) => next.delete(p.id));
      else visible.forEach((p) => next.add(p.id));
      return next;
    });
  };
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canSend = selected.size > 0 && body.trim().length > 0 && body.length <= MAX_LEN;

  const handleSend = () => {
    if (!canSend) return;
    compose({
      recipientIds: Array.from(selected),
      body: body.trim(),
      urgent,
    });
    toast.success(
      `Message sent to ${selected.size} recipient${selected.size === 1 ? "" : "s"}`
    );
    resetAndClose();
  };

  const resetAndClose = () => {
    setSelected(new Set());
    setBody("");
    setUrgent(false);
    setQuery("");
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => (!o ? resetAndClose() : onOpenChange(o))}
      title="Compose Message"
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend}>
            <Send className="size-3.5" /> Send Message
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Recipients column */}
        <section className="flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold">Recipients</h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {String(selected.size).padStart(2, "0")} Selected
            </span>
          </div>
          <div className="relative mb-2">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full h-9 rounded-full border border-border bg-white pl-9 pr-3 text-sm ring-focus"
            />
          </div>
          <div className="rounded-2xl bg-white border border-border overflow-hidden">
            <label className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-pointer hover:bg-surface-subtle">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="size-4 rounded border-border"
              />
              <span className="text-sm font-medium">Select All</span>
            </label>
            <ul className="max-h-72 overflow-y-auto divide-y divide-border">
              {visible.length === 0 && (
                <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No matches.
                </li>
              )}
              {visible.map((p) => (
                <li key={p.id}>
                  <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-surface-subtle">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      className="size-4 rounded border-border"
                    />
                    <span className="text-sm truncate">{p.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Content column */}
        <section className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold">Message Content</h3>
            <span
              className={cn(
                "text-xs tabular-nums",
                body.length > MAX_LEN
                  ? "text-danger font-semibold"
                  : "text-muted-foreground"
              )}
            >
              {body.length}/{MAX_LEN} characters
            </span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your text message..."
            rows={8}
            className="w-full resize-none rounded-2xl border border-border bg-white p-3 text-sm ring-focus min-h-[160px]"
          />
          <label className="mt-3 inline-flex items-center gap-2 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={urgent}
              onChange={(e) => setUrgent(e.target.checked)}
              className="size-4 rounded border-border"
            />
            <span className="text-sm">Urgent</span>
          </label>
          {body.length > MAX_LEN && (
            <p className="mt-2 text-xs text-danger">
              Message exceeds SMS length budget. Trim to {MAX_LEN} characters.
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}
