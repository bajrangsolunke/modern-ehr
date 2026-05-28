/**
 * Segmented chip control for selecting an AI-assist mode.
 * Clicking the active chip toggles it off (sets mode → null).
 */
import { FileText, Mic, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

export type AssistMode = "intake" | "transcript" | "record";

interface AssistPickerProps {
  mode: AssistMode | null;
  onChange: (mode: AssistMode | null) => void;
}

const OPTIONS: Array<{ id: AssistMode; label: string; icon: typeof Mic; desc: string }> = [
  {
    id: "intake",
    label: "From intake",
    icon: FileText,
    desc: "Draft Subjective from the patient's latest intake form",
  },
  {
    id: "transcript",
    label: "From transcript",
    icon: Stethoscope,
    desc: "Paste or dictate an encounter transcript — AI fills all 4 sections",
  },
  {
    id: "record",
    label: "Record",
    icon: Mic,
    desc: "Ambient scribe — record the visit and AI structures the SOAP note",
  },
];

export function AssistPicker({ mode, onChange }: AssistPickerProps) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
        AI assist (optional)
      </div>
      <div className="flex gap-2 flex-wrap">
        {OPTIONS.map(({ id, label, icon: Icon, desc }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(active ? null : id)}
              aria-pressed={active}
              title={desc}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5"
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
