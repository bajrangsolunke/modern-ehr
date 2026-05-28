import { useMemo, useState } from "react";
import { Search, Send } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { usePatients } from "@/features/patients/hooks/use-patients";
import { useUsers } from "@/features/users/hooks/use-users";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useComposeBroadcast } from "../hooks/use-messages";
import type { Audience } from "../types";
import { cn } from "@/lib/utils";

const MAX_LEN = 160;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAudience: Audience;
}

interface Recipient {
  id: string;
  name: string;
  hint?: string;
}

export function ComposeMessageModal({ open, onOpenChange, defaultAudience }: Props) {
  const compose = useComposeBroadcast();

  const [audience] = useState<Audience>(defaultAudience);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 200);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [body, setBody] = useState("");
  const [urgent, setUrgent] = useState(false);

  // Only fetch the audience the user is composing for — the other
  // query is skipped entirely via { enabled: false } instead of firing
  // a wasteful page_size:1 placeholder.
  const patientsQuery = usePatients(
    { q: debouncedQuery || undefined, page: 1, page_size: 30 },
    { enabled: open && audience === "patient" }
  );
  const usersQuery = useUsers(
    { q: debouncedQuery || undefined, page: 1, page_size: 30, is_active: true },
    { enabled: open && audience === "clinician" }
  );

  const recipients: Recipient[] = useMemo(() => {
    if (audience === "patient") {
      return (patientsQuery.data?.items ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        hint: p.mrn ? `MRN ${p.mrn}` : undefined,
      }));
    }
    return (usersQuery.data?.items ?? []).map((u) => ({
      id: u.id,
      name: u.fullName,
      hint: u.specialty ?? u.role,
    }));
  }, [audience, patientsQuery.data, usersQuery.data]);

  const allSelected = recipients.length > 0 && recipients.every((p) => selected.has(p.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) recipients.forEach((p) => next.delete(p.id));
      else recipients.forEach((p) => next.add(p.id));
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

  const canSend =
    selected.size > 0 &&
    body.trim().length > 0 &&
    body.length <= MAX_LEN &&
    !compose.isPending;

  const handleSend = async () => {
    if (!canSend) return;
    await compose.mutateAsync({
      audience,
      recipientIds: Array.from(selected),
      body: body.trim(),
      urgent,
    });
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
            <Send className="size-3.5" />
            {compose.isPending ? "Sending…" : "Send Message"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
              {recipients.length === 0 && (
                <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {patientsQuery.isLoading || usersQuery.isLoading
                    ? "Loading…"
                    : "No matches."}
                </li>
              )}
              {recipients.map((r) => (
                <li key={r.id}>
                  <label className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-surface-subtle">
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                        className="size-4 rounded border-border"
                      />
                      <span className="text-sm truncate">{r.name}</span>
                    </div>
                    {r.hint && (
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {r.hint}
                      </span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </section>

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
