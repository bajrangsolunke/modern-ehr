/**
 * MedScribe ambient AI scribe workspace.
 * Manages the full recording → finalize → edit cycle for a single session.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mic, MicOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AiTag } from "@/components/ui/ai-tag";
import { cn } from "@/lib/utils";
import { usePatient } from "@/features/patients/hooks/use-patient";

import { Waveform } from "./components/Waveform";
import { PipelineStrip } from "./components/PipelineStrip";
import { TranscriptPanel } from "./components/TranscriptPanel";
import { SoapPanel } from "./components/SoapPanel";
import { IcdSuggestionsList } from "./components/IcdSuggestionsList";
import { SummaryCard } from "./components/SummaryCard";
import { useRecorder } from "./hooks/use-recorder";
import { useStreamingSession } from "./hooks/use-streaming-session";
import {
  usePatientScribeSessions,
  useScribeSession,
} from "./hooks/use-scribe";

// ---------------------------------------------------------------------------
// Elapsed recording timer
// ---------------------------------------------------------------------------

function useElapsedSeconds(active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [active]);

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Status label
// ---------------------------------------------------------------------------

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "danger" | "info" | "neutral" | "outline";

function statusBadge(state: string): { label: string; variant: BadgeVariant } {
  switch (state) {
    case "idle":
      return { label: "Ready", variant: "neutral" };
    case "creating":
      return { label: "Starting…", variant: "info" };
    case "recording":
      return { label: "● Recording", variant: "danger" };
    case "finalizing":
      return { label: "Processing…", variant: "warning" };
    case "completed":
      return { label: "Completed", variant: "success" };
    case "failed":
      return { label: "Failed", variant: "danger" };
    default:
      return { label: state, variant: "neutral" };
  }
}

// ---------------------------------------------------------------------------
// Historical session row
// ---------------------------------------------------------------------------

function SessionRow({
  sessionId,
  status,
  startedAt,
  chiefComplaint,
  patientId,
  activeSessionId,
}: {
  sessionId: string;
  status: string;
  startedAt: string;
  chiefComplaint: string | null;
  patientId: string;
  activeSessionId: string | null;
}) {
  const isActive = activeSessionId === sessionId;
  const date = new Date(startedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <Link
      to={`/patients/${patientId}/scribe?session=${sessionId}`}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm hover:border-primary/40 transition-colors",
        isActive && "border-primary/40 bg-primary/5"
      )}
    >
      <span className="truncate text-foreground font-medium">
        {chiefComplaint ?? "No chief complaint"}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">{date}</span>
        <Badge
          variant={statusBadge(status).variant}
          size="sm"
        >
          {statusBadge(status).label}
        </Badge>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ScribePage() {
  const { patientId = "" } = useParams<{ patientId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const historySessionId = searchParams.get("session");

  const { data: patient } = usePatient(patientId);
  const { data: sessions } = usePatientScribeSessions(patientId);

  // Live session state machine
  const streaming = useStreamingSession(patientId);

  // Historical session
  const { data: historyFull } = useScribeSession(
    historySessionId ?? undefined
  );

  // Recorder — wired to streaming.uploadChunk
  const recorder = useRecorder({
    chunkMs: 4000,
    onChunk: streaming.uploadChunk,
  });

  const [chiefComplaint, setChiefComplaint] = useState("");

  const elapsedLabel = useElapsedSeconds(recorder.state === "recording");

  const handleStart = async () => {
    await streaming.start(chiefComplaint || undefined);
    await recorder.start();
  };

  const handleStop = () => {
    recorder.stop();
    streaming.stop();
  };

  // After recording stops and streaming has a session id, switch to live mode
  const liveSessionId = streaming.session?.id;
  const { data: liveFull, isLoading: liveLoading } = useScribeSession(
    streaming.state === "completed" ? liveSessionId : undefined
  );

  // Pick which full session data to show in the workspace
  const workspaceSession = historySessionId
    ? historyFull
    : streaming.state === "completed"
    ? liveFull
    : null;

  const isRecording = recorder.state === "recording";
  const isWorking =
    streaming.state === "creating" || streaming.state === "finalizing";
  const showWorkspace = workspaceSession !== null;

  const badge = statusBadge(
    historySessionId ? (historyFull?.status ?? "idle") : streaming.state
  );

  const patientName = patient?.name ?? "Patient";

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/patients/${patientId}`)}
            className="gap-1.5 -ml-1"
          >
            <ArrowLeft className="size-3.5" />
            {patientName}
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span className="text-base font-semibold">Ambient scribe</span>
            <AiTag>Beta</AiTag>
          </div>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {/* Historical sessions */}
      {sessions && sessions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Prior scribe sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {sessions.map((s) => (
              <SessionRow
                key={s.id}
                sessionId={s.id}
                status={s.status}
                startedAt={s.startedAt}
                chiefComplaint={s.chiefComplaint}
                patientId={patientId}
                activeSessionId={historySessionId}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recording control area — only show when no historical session selected */}
      {!historySessionId && (
        <Card>
          <CardContent className="pt-6 space-y-5">
            {/* Chief complaint */}
            {streaming.state === "idle" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Chief complaint (optional)
                </label>
                <Input
                  placeholder="e.g. chest pain, follow-up hypertension…"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                />
              </div>
            )}

            {/* Waveform when recording */}
            {isRecording && (
              <div className="flex items-center gap-4 rounded-2xl border border-danger/30 bg-danger/5 p-4">
                <Waveform stream={recorder.stream} className="flex-1" />
                <span className="text-sm font-mono text-danger font-semibold shrink-0">
                  {elapsedLabel}
                </span>
              </div>
            )}

            {/* Error */}
            {(streaming.error ?? recorder.error) && (
              <p className="text-sm text-danger rounded-xl border border-danger/20 bg-danger/5 px-3 py-2">
                {streaming.error ?? recorder.error}
              </p>
            )}

            {/* Controls */}
            <div className="flex gap-3">
              {streaming.state === "idle" && (
                <Button
                  onClick={handleStart}
                  className="gap-2"
                  disabled={recorder.state === "recording"}
                >
                  <Mic className="size-4" />
                  Start recording
                </Button>
              )}
              {isRecording && (
                <Button
                  variant="destructive"
                  onClick={handleStop}
                  className="gap-2"
                >
                  <MicOff className="size-4" />
                  Stop &amp; finalize
                </Button>
              )}
              {isWorking && (
                <Button disabled>
                  <span className="animate-pulse">
                    {streaming.state === "creating"
                      ? "Starting session…"
                      : "Processing…"}
                  </span>
                </Button>
              )}
            </div>

            {/* Pipeline strip */}
            {streaming.state !== "idle" && (
              <div className="pt-2">
                <PipelineStrip
                  stages={streaming.stages}
                  finalState={streaming.state}
                  transcript={streaming.transcript}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Live transcript during recording / finalizing */}
      {!historySessionId && streaming.state !== "idle" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Live transcript</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <TranscriptPanel transcript={streaming.transcript} />
            </CardContent>
          </Card>

          {streaming.state === "completed" && liveLoading && (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-border p-12 text-muted-foreground text-sm">
              Loading AI workspace…
            </div>
          )}
        </div>
      )}

      {/* Workspace — historical or completed live session */}
      {showWorkspace && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: transcript */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Transcript</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <TranscriptPanel
                transcript={workspaceSession.transcriptText ?? ""}
              />
            </CardContent>
          </Card>

          {/* Right: AI outputs */}
          <div className="space-y-6">
            {/* SOAP */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="size-3.5 text-primary" />
                  SOAP Note
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <SoapPanel
                  sessionId={workspaceSession.id}
                  soap={workspaceSession.soapNote}
                />
              </CardContent>
            </Card>

            {/* ICD suggestions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="size-3.5 text-primary" />
                  ICD-10 Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <IcdSuggestionsList
                  sessionId={workspaceSession.id}
                  suggestions={workspaceSession.icdSuggestions}
                />
              </CardContent>
            </Card>

            {/* Visit summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="size-3.5 text-primary" />
                  Visit Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <SummaryCard
                  sessionId={workspaceSession.id}
                  summary={workspaceSession.visitSummary}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
