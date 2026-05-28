/**
 * SoapNotePage — consolidated full-screen SOAP note authoring page.
 *
 * Routes:
 *   /patients/:patientId/notes/new      → create mode (shows AI-assist picker)
 *   /patients/:patientId/notes/:noteId  → edit mode (pre-fills from existing note)
 *
 * AI-assist modes (create only):
 *   "intake"     → IntakeAssistPanel  — fills Subjective from intake form
 *   "transcript" → TranscriptAssistPanel — paste transcript → all 4 fields
 *   "record"     → RecordingPanel — ambient scribe → fills SOAP + surfaces ICD/summary
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AiTag } from "@/components/ui/ai-tag";
import { useForm, zodResolver, z } from "@/lib/form";
import { toast } from "@/lib/toast";
import { usePatient } from "@/features/patients/hooks/use-patient";
import {
  useCreateNote,
  useNotes,
  useUpdateNote,
} from "@/features/patients/hooks/use-notes";
import { patientsAiApi } from "@/features/patients/api/ai-api";
import { IcdSuggestionsList } from "@/features/scribe/components/IcdSuggestionsList";
import { SummaryCard } from "@/features/scribe/components/SummaryCard";
import type { ScribeSessionFull } from "@/features/scribe/api/scribe-api";

import { AssistPicker, type AssistMode } from "./components/AssistPicker";
import { RecordingPanel } from "./components/RecordingPanel";
import { SoapEditor, type SoapValues } from "./components/SoapEditor";

// ---------------------------------------------------------------------------
// Zod schema (mirrors SoapNoteDrawer)
// ---------------------------------------------------------------------------

const schema = z
  .object({
    subjective: z.string().optional().or(z.literal("")),
    objective: z.string().optional().or(z.literal("")),
    assessment: z.string().optional().or(z.literal("")),
    plan: z.string().optional().or(z.literal("")),
  })
  .refine(
    (v) =>
      Boolean(
        (v.subjective ?? "").trim() ||
          (v.objective ?? "").trim() ||
          (v.assessment ?? "").trim() ||
          (v.plan ?? "").trim()
      ),
    { message: "Add content to at least one section", path: ["subjective"] }
  );

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Intake assist panel
// ---------------------------------------------------------------------------

interface IntakeAssistPanelProps {
  patientId: string;
  onFilled: (subjective: string) => void;
}

function IntakeAssistPanel({ patientId, onFilled }: IntakeAssistPanelProps) {
  const [filling, setFilling] = useState(false);
  const [filledFrom, setFilledFrom] = useState<{
    model: string;
    confidence: number;
  } | null>(null);

  const handleFill = async () => {
    setFilling(true);
    try {
      const draft = await patientsAiApi.soapFromIntake(patientId);
      onFilled(draft.subjective);
      setFilledFrom({ model: draft.model, confidence: draft.confidence });
      toast.success(
        "Subjective drafted from intake — please review and document O/A/P after exam"
      );
    } catch (err) {
      toast.error("Couldn't draft Subjective from intake", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setFilling(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <Sparkles className="size-5 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                Draft Subjective from intake
                <AiTag>Beta</AiTag>
                {filledFrom && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    · {filledFrom.model} ·{" "}
                    {Math.round(filledFrom.confidence * 100)}% confidence
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                AI fills only the Subjective section from the patient&apos;s
                most recent intake form. Objective, Assessment, and Plan must be
                documented from the encounter — intake has no exam findings.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleFill}
            disabled={filling}
            className="shrink-0"
          >
            {filling ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {filling
              ? "Drafting…"
              : filledFrom
              ? "Re-draft Subjective"
              : "Draft Subjective"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Transcript assist panel
// ---------------------------------------------------------------------------

interface TranscriptAssistPanelProps {
  patientId: string;
  onDrafted: (soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  }) => void;
}

function TranscriptAssistPanel({
  patientId,
  onDrafted,
}: TranscriptAssistPanelProps) {
  const [transcript, setTranscript] = useState("");
  const [scribing, setScribing] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const handleGenerate = async () => {
    if (!transcript.trim()) {
      toast.error("Paste or dictate a transcript first");
      return;
    }
    setScribing(true);
    try {
      const soap = await patientsAiApi.scribeFromTranscript(
        transcript,
        patientId
      );
      onDrafted(soap);
      toast.success(
        "SOAP drafted from transcript — please review before saving"
      );
    } catch (err) {
      toast.error("Couldn't generate SOAP", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setScribing(false);
    }
  };

  return (
    <Card>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full px-6 py-4 flex items-center justify-between gap-3 text-left hover:bg-muted/30 transition rounded-t-2xl"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="size-5 text-primary shrink-0" />
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              AI scribe — paste or dictate transcript
              <AiTag>Beta</AiTag>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Paste your dictation or notes — AI drafts all four SOAP sections.
            </p>
          </div>
        </div>
        <ChevronDown
          className={`size-4 text-muted-foreground shrink-0 transition-transform ${
            expanded ? "" : "-rotate-90"
          }`}
          aria-hidden
        />
      </button>

      {expanded && (
        <CardContent className="pt-0 pb-5 space-y-3">
          <Textarea
            rows={6}
            placeholder="Paste your dictation here, e.g. 'Patient presents with 3-day history of dyspnea on exertion. Denies chest pain. BP 142/88, HR 92, afebrile. Lungs clear bilaterally. Suspect early CHF, will order BNP and echo, start lisinopril 5 mg daily, follow up in 1 week.'"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {transcript.length} chars
            </span>
            <Button
              type="button"
              size="sm"
              onClick={handleGenerate}
              disabled={scribing || !transcript.trim()}
            >
              {scribing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {scribing ? "Generating…" : "Generate SOAP"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ICD + summary wrappers
// ---------------------------------------------------------------------------

function ScribeIcdSection({
  session,
}: {
  session: ScribeSessionFull;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          AI-suggested ICD-10 codes
          <AiTag>Beta</AiTag>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <IcdSuggestionsList
          sessionId={session.id}
          suggestions={session.icdSuggestions}
        />
      </CardContent>
    </Card>
  );
}

function ScribeSummarySection({
  session,
}: {
  session: ScribeSessionFull;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          Patient-facing summary
          <AiTag>Beta</AiTag>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <SummaryCard
          sessionId={session.id}
          summary={session.visitSummary}
        />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function SoapNotePage() {
  const { patientId = "", noteId } = useParams<{
    patientId: string;
    noteId?: string;
  }>();
  const navigate = useNavigate();
  const isEdit = Boolean(noteId);

  const { data: patient } = usePatient(patientId);
  const { data: allNotes } = useNotes(isEdit ? patientId : undefined);

  const existingNote = isEdit && noteId
    ? (allNotes ?? []).find((n) => n.id === noteId)
    : undefined;

  const create = useCreateNote(patientId);
  const update = useUpdateNote(patientId);

  // AI assist mode
  const [assistMode, setAssistMode] = useState<AssistMode | null>(null);

  // Scribe session (populated after RecordingPanel completes)
  const [scribeSession, setScribeSession] =
    useState<ScribeSessionFull | null>(null);

  // SOAP form values (uncontrolled via react-hook-form at submit, but we also
  // need controlled values to pre-fill from AI assist panels)
  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
    },
  });

  // Pre-fill form when existing note loads
  useEffect(() => {
    if (existingNote) {
      reset({
        subjective: existingNote.subjective ?? "",
        objective: existingNote.objective ?? "",
        assessment: existingNote.assessment ?? "",
        plan: existingNote.plan ?? "",
      });
    }
  }, [existingNote, reset]);

  // Watch all four fields for the SoapEditor controlled display and hasContent guard
  const watched = watch();
  const soapValues: SoapValues = {
    subjective: watched.subjective ?? "",
    objective: watched.objective ?? "",
    assessment: watched.assessment ?? "",
    plan: watched.plan ?? "",
  };

  const hasContent = Boolean(
    soapValues.subjective.trim() ||
      soapValues.objective.trim() ||
      soapValues.assessment.trim() ||
      soapValues.plan.trim()
  );

  const fillSoap = (soap: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  }) => {
    if (soap.subjective !== undefined)
      setValue("subjective", soap.subjective, { shouldDirty: true });
    if (soap.objective !== undefined)
      setValue("objective", soap.objective, { shouldDirty: true });
    if (soap.assessment !== undefined)
      setValue("assessment", soap.assessment, { shouldDirty: true });
    if (soap.plan !== undefined)
      setValue("plan", soap.plan, { shouldDirty: true });
  };

  const handleEditorChange = (vals: SoapValues) => {
    setValue("subjective", vals.subjective, { shouldDirty: true });
    setValue("objective", vals.objective, { shouldDirty: true });
    setValue("assessment", vals.assessment, { shouldDirty: true });
    setValue("plan", vals.plan, { shouldDirty: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      subjective: values.subjective || null,
      objective: values.objective || null,
      assessment: values.assessment || null,
      plan: values.plan || null,
    };

    if (isEdit && noteId) {
      await update.mutateAsync({ id: noteId, input: payload });
    } else {
      await create.mutateAsync({ patient_id: patientId, ...payload });
    }
    navigate(`/patients/${patientId}?tab=notes`);
  });

  const submitting = isSubmitting || create.isPending || update.isPending;

  const patientName = patient?.name ?? "Patient";
  const patientMrn = patient?.mrn ?? "—";

  return (
    <div className="space-y-6 pb-28">
      {/* Back link */}
      <div>
        <Link
          to={`/patients/${patientId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to {patientName}
        </Link>
      </div>

      {/* Header */}
      <header className="space-y-0.5">
        <h1 className="text-2xl font-bold tracking-tight">
          {isEdit ? "Edit SOAP note" : "New SOAP note"}
        </h1>
        <p className="text-sm text-muted-foreground">
          For {patientName} · MRN {patientMrn}
        </p>
      </header>

      {/* AI assist picker — create mode only */}
      {!isEdit && (
        <AssistPicker mode={assistMode} onChange={setAssistMode} />
      )}

      {/* Selected assist panel */}
      {!isEdit && assistMode === "intake" && (
        <IntakeAssistPanel
          patientId={patientId}
          onFilled={(s) => setValue("subjective", s, { shouldDirty: true })}
        />
      )}
      {!isEdit && assistMode === "transcript" && (
        <TranscriptAssistPanel
          patientId={patientId}
          onDrafted={fillSoap}
        />
      )}
      {!isEdit && assistMode === "record" && (
        <RecordingPanel
          patientId={patientId}
          onSessionCompleted={(sessionFull) => {
            if (sessionFull.soapNote) {
              fillSoap({
                subjective: sessionFull.soapNote.subjective,
                objective: sessionFull.soapNote.objective,
                assessment: sessionFull.soapNote.assessment,
                plan: sessionFull.soapNote.plan,
              });
            }
            setScribeSession(sessionFull);
          }}
        />
      )}

      {/* Two-column layout: SOAP editor (7 cols) + side panels (5 cols) */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <SoapEditor
            values={soapValues}
            onChange={handleEditorChange}
            errors={{
              subjective: errors.subjective?.message,
            }}
          />
        </div>

        <div className="lg:col-span-5 space-y-4">
          {scribeSession && (
            <>
              <ScribeIcdSection session={scribeSession} />
              <ScribeSummarySection session={scribeSession} />
            </>
          )}
        </div>
      </div>

      {/* Sticky footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/80 backdrop-blur-md px-6 py-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate(-1)}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void onSubmit()}
          disabled={submitting || !hasContent}
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting
            ? "Saving…"
            : isEdit
            ? "Save changes"
            : "Save note"}
        </Button>
      </footer>
    </div>
  );
}
