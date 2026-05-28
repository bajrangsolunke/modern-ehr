/**
 * Key clinical overview card. Bound to the real patient row + the
 * medications list. Inline-edit affordances on ASA and ICU; other
 * rows fall through to the existing patient edit drawer via the
 * header pencil icon, since those fields don't have first-class
 * frontend types yet (allergies / conditions / language live in the
 * intake form for now).
 */
import { useState } from "react";
import { Check, ChevronDown, Pencil } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUpdatePatient } from "@/features/patients/hooks/use-update-patient";
import { useMedications } from "@/features/patients/hooks/use-medications";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types";

interface Props {
  patient: Patient;
  /** Open the patient demographics edit drawer (lives in the parent page). */
  onEdit?: () => void;
}

const ASA_OPTIONS = ["I", "II", "III", "IV"] as const;
type Asa = (typeof ASA_OPTIONS)[number];

export function KeyClinicalOverview({ patient, onEdit }: Props) {
  const update = useUpdatePatient(patient.id);
  const { data: meds } = useMedications(patient.id);

  // Medications row shows up-to-two active names + "+N more"
  const activeMeds = (meds ?? []).filter((m) => m.status === "active");
  const medSummary =
    activeMeds.length === 0
      ? "None on file"
      : activeMeds.slice(0, 2).map((m) => m.name).join(", ") +
        (activeMeds.length > 2 ? `, +${activeMeds.length - 2} more` : "");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Key clinical overview</CardTitle>
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onEdit}
            aria-label="Edit patient details"
            title="Edit patient details"
          >
            <Pencil className="size-3.5" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2 pb-5">
        <ReadonlyRow label="Language" value="From intake form" />
        <ReadonlyRow label="Allergies" value="From intake form" />
        <ReadonlyRow label="Pre-existing conditions" value="From intake form" />
        <ReadonlyRow label="Medications" value={medSummary} />
        <ReadonlyRow label="DNR / DNI" value="Not on file" />

        {/* ASA — inline editable dropdown */}
        <AsaRow
          value={patient.asa}
          onChange={(asa) => update.mutate({ asa })}
        />

        {/* ICU — inline toggle */}
        <IcuRow
          value={patient.icu ?? false}
          onChange={(icu) => update.mutate({ icu_needed: icu })}
        />

        <ReadonlyRow label="Last lab date" value="—" />
      </CardContent>
    </Card>
  );
}

function ReadonlyRow({
  label,
  value,
  extra,
  pill,
}: {
  label: string;
  value: React.ReactNode;
  extra?: string;
  pill?: { label: string; variant: "warning" | "info" | "success" };
}) {
  return (
    <div className="flex items-center justify-between gap-2 bg-surface-subtle rounded-xl px-3.5 py-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <div className="flex items-center gap-2 text-right">
        <span className="font-semibold">{value}</span>
        {extra && <span className="text-xs text-muted-foreground">({extra})</span>}
        {pill && (
          <Badge variant={pill.variant} dot size="sm">
            {pill.label}
          </Badge>
        )}
      </div>
    </div>
  );
}

function AsaRow({
  value,
  onChange,
}: {
  value: Asa | undefined;
  onChange: (asa: Asa) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = value ? `ASA ${value}` : "Not set";

  return (
    <div className="flex items-center justify-between gap-2 bg-surface-subtle rounded-xl px-3.5 py-2 text-sm">
      <span className="text-muted-foreground">ASA classification:</span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 font-semibold rounded-lg px-2 -mr-1 hover:bg-white/60 transition"
            title="Click to change ASA classification"
          >
            {label}
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            className="z-50 w-32 rounded-2xl bg-white shadow-elev border border-border p-1.5 animate-fade-in"
          >
            {ASA_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between w-full px-3 py-2 text-sm rounded-xl hover:bg-secondary text-left",
                  value === opt && "font-semibold"
                )}
              >
                ASA {opt}
                {value === opt && <Check className="size-3.5 text-primary" />}
              </button>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function IcuRow({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (icu: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 bg-surface-subtle rounded-xl px-3.5 py-2 text-sm">
      <span className="text-muted-foreground">ICU need:</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={cn(
            "inline-flex items-center gap-1 font-semibold rounded-lg px-2 hover:bg-white/60 transition",
            value ? "text-danger" : "text-muted-foreground"
          )}
          title="Click to toggle ICU requirement"
        >
          {value ? "Required" : "Not required"}
          <Pencil className="size-3 opacity-60" />
        </button>
        {value && (
          <Badge variant="warning" dot size="sm">
            Confirmation pending
          </Badge>
        )}
      </div>
    </div>
  );
}
