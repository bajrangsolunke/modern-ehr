/**
 * IcdSuggestPanel — ephemeral AI-suggested ICD-10 codes for SOAP notes.
 *
 * Sits in the right column of SoapNotePage. The user clicks "Suggest codes"
 * and the panel calls the /ai/icd-suggest endpoint with the current SOAP
 * text. Results are ephemeral — not persisted to the DB in Phase 1.
 */
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AiTag } from "@/components/ui/ai-tag";
import { patientsAiApi, type IcdSuggestion, type IcdSuggestResponse } from "@/features/patients/api/ai-api";
import { toast } from "@/lib/toast";

interface Props {
  patientId: string;
  /** Combined SOAP text the AI uses to suggest. Pass assessment + plan
   *  for best results; subjective + objective help too if available. */
  soapText: string;
  /** Optional note id for traceability in audit logs. */
  noteId?: string;
}

// ---------------------------------------------------------------------------
// Confidence pill
// ---------------------------------------------------------------------------

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80
      ? "bg-green-100 text-green-800"
      : pct >= 60
      ? "bg-amber-100 text-amber-800"
      : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}
    >
      {pct}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Validation chip
// ---------------------------------------------------------------------------

function ValidationChip({ isValidated }: { isValidated: boolean }) {
  if (isValidated) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-semibold">
        ✓ Validated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold">
      ⚠ Not in catalog
    </span>
  );
}

// ---------------------------------------------------------------------------
// Suggestion row
// ---------------------------------------------------------------------------

function SuggestionRow({ s }: { s: IcdSuggestion }) {
  return (
    <li className="py-2.5 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold tracking-tight">{s.code}</span>
            <ConfidencePill value={s.confidence} />
            <ValidationChip isValidated={s.isValidated} />
          </div>
          <p className="text-sm text-foreground">{s.description}</p>
          {s.reasoning && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {s.reasoning}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function IcdSuggestPanel({ patientId, soapText, noteId }: Props) {
  const [result, setResult] = useState<IcdSuggestResponse | null>(null);

  const trimmed = soapText.trim();
  const tooShort = trimmed.length < 20;

  const mutation = useMutation({
    mutationFn: () =>
      patientsAiApi.suggestIcd({ text: trimmed, patientId, noteId }),
    onSuccess: (data) => {
      setResult(data);
      if (data.suggestions.length === 0) {
        toast.info("No ICD codes suggested — try adding more Assessment + Plan detail.");
      }
    },
    onError: (err) => {
      toast.error("Couldn't fetch ICD suggestions", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

  const isPending = mutation.isPending;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          AI-suggested ICD-10 codes
          <AiTag>Beta</AiTag>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          AI reads your Assessment + Plan and suggests the most clinically
          appropriate ICD-10-CM codes. Results are a starting point — always
          verify before billing.
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => mutation.mutate()}
            disabled={isPending || tooShort}
            title={tooShort ? "Write some Assessment + Plan first." : undefined}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {isPending
              ? "Analyzing assessment + plan…"
              : result
              ? "Re-suggest"
              : "Suggest codes"}
          </Button>

          {tooShort && (
            <span className="text-xs text-muted-foreground">
              Write some Assessment + Plan first.
            </span>
          )}
        </div>

        {result && result.suggestions.length > 0 && (
          <ul className="divide-y divide-transparent">
            {result.suggestions.map((s) => (
              <SuggestionRow key={s.code} s={s} />
            ))}
          </ul>
        )}

        {result && result.suggestions.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No suggestions returned — try expanding the Assessment + Plan sections.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
