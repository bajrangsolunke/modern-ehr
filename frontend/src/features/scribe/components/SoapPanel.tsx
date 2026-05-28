/**
 * Editable SOAP note panel with debounced auto-save.
 * Shows an AI-drafted banner and four labeled textareas.
 */
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { usePatchSoap } from "../hooks/use-scribe";
import type { ScribeSoapNote } from "../api/scribe-api";

interface SoapPanelProps {
  sessionId: string;
  soap: ScribeSoapNote | null;
}

const SECTIONS = [
  { key: "subjective", label: "Subjective" },
  { key: "objective", label: "Objective" },
  { key: "assessment", label: "Assessment" },
  { key: "plan", label: "Plan" },
] as const;

type SoapKey = (typeof SECTIONS)[number]["key"];

export function SoapPanel({ sessionId, soap }: SoapPanelProps) {
  const patch = usePatchSoap(sessionId);

  const [values, setValues] = useState<Record<SoapKey, string>>({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });

  // Seed local state when soap arrives from the server
  useEffect(() => {
    if (soap) {
      setValues({
        subjective: soap.subjective,
        objective: soap.objective,
        assessment: soap.assessment,
        plan: soap.plan,
      });
    }
  }, [soap]);

  // Debounced PATCH
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (key: SoapKey, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      patch.mutate({ [key]: value });
    }, 300);
  };

  const disabled = !soap;

  return (
    <div className="space-y-4">
      {/* AI banner */}
      <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
        <Sparkles className="size-3.5 text-primary shrink-0" />
        <p className="text-xs text-primary font-medium">
          AI-drafted — please review and verify before saving to chart
        </p>
      </div>

      {SECTIONS.map(({ key, label }) => (
        <div key={key} className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {label}
          </label>
          <Textarea
            rows={4}
            disabled={disabled}
            placeholder={disabled ? "Waiting for AI…" : `Enter ${label.toLowerCase()}…`}
            value={values[key]}
            onChange={(e) => handleChange(key, e.target.value)}
            className="text-sm"
          />
        </div>
      ))}
    </div>
  );
}
