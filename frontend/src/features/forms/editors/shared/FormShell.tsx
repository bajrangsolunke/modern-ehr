/**
 * Layout chrome for the multi-section form editors (intake + consent).
 * Renders:
 *   - Top bar:  ← title  ............................  Cancel · Save
 *   - Sidebar:  list of sections with green check when complete
 *   - Body:     accordion of sections
 *
 * Sections are passed in by the editor. The shell handles open/close
 * state, completion flagging, and the cancel/save plumbing.
 */
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FormSection {
  id: string;
  label: string;
  /** True when all required fields in this section are filled. */
  complete: boolean;
  /** Renders the section body inside an accordion. */
  render: () => React.ReactNode;
}

interface Props {
  title: string;
  sections: FormSection[];
  onBack: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
  /** Disable Save until the editor's overall validation passes. */
  canSave: boolean;
}

export function FormShell({
  title,
  sections,
  onBack,
  onCancel,
  onSave,
  saving,
  canSave,
}: Props) {
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(sections.map((s) => s.id))
  );

  const toggle = (id: string) =>
    setOpenIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const scrollTo = (id: string) => {
    setOpenIds((cur) => (cur.has(id) ? cur : new Set([...cur, id])));
    // Defer scrolling so the accordion body has expanded first.
    requestAnimationFrame(() => {
      const el = document.getElementById(`section-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const completedCount = sections.filter((s) => s.complete).length;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            onClick={onBack}
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave || saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Sidebar — progress tracker */}
        <aside className="lg:sticky lg:top-[100px] self-start">
          <nav className="rounded-2xl bg-white border border-border shadow-soft p-3">
            <div className="px-2 py-1.5 mb-1.5 border-b border-border">
              <h2 className="text-sm font-bold">Sections</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                {completedCount} of {sections.length} complete
              </p>
            </div>
            <ul className="space-y-0.5">
              {sections.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => scrollTo(s.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-2 rounded-xl transition text-left ring-focus",
                      s.complete
                        ? "text-success hover:bg-success/5"
                        : "text-foreground hover:bg-surface-subtle"
                    )}
                  >
                    {s.complete ? (
                      <CheckCircle2 className="size-4 shrink-0" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium truncate">
                      {s.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Accordion body */}
        <div className="min-w-0 space-y-3">
          {sections.map((s) => {
            const open = openIds.has(s.id);
            return (
              <section
                key={s.id}
                id={`section-${s.id}`}
                className="rounded-2xl bg-white border border-border shadow-soft overflow-hidden scroll-mt-24"
              >
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3 hover:bg-surface-subtle transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {s.complete ? (
                      <CheckCircle2 className="size-4 text-success shrink-0" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <h3 className="text-[15px] font-bold truncate">{s.label}</h3>
                  </div>
                  {open ? (
                    <ChevronUp className="size-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {open && (
                  <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-border">
                    {s.render()}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
