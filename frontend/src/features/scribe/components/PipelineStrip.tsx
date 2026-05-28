/**
 * 4-stage AI pipeline progress strip.
 * Shows: Transcript → SOAP → ICD → Summary with animated status dots.
 */
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StreamingSessionState } from "../hooks/use-streaming-session";

type StageStatus = "pending" | "started" | "completed" | "failed";

interface Stages {
  soap: StageStatus;
  icd: StageStatus;
  summary: StageStatus;
}

interface PipelineStripProps {
  stages: Stages;
  finalState: StreamingSessionState;
  transcript: string;
}

interface StepProps {
  label: string;
  status: StageStatus;
  isActive: boolean;
}

function Step({ label, status, isActive }: StepProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div className="relative flex items-center justify-center w-7 h-7">
        {status === "completed" ? (
          <CheckCircle2 className="size-5 text-success" />
        ) : status === "failed" ? (
          <XCircle className="size-5 text-danger" />
        ) : status === "started" ? (
          <Loader2 className="size-5 text-primary animate-spin" />
        ) : (
          <div
            className={cn(
              "size-3 rounded-full border-2",
              isActive
                ? "border-primary bg-primary/20 animate-pulse"
                : "border-muted-foreground/30 bg-muted"
            )}
          />
        )}
      </div>
      <span
        className={cn(
          "text-[11px] font-medium text-center leading-tight",
          status === "completed"
            ? "text-success"
            : status === "failed"
            ? "text-danger"
            : status === "started"
            ? "text-primary"
            : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function PipelineStrip({
  stages,
  finalState,
  transcript,
}: PipelineStripProps) {
  // Transcript step is "completed" when we're in finalizing/completed state
  const transcriptStatus: StageStatus =
    finalState === "completed" || finalState === "finalizing"
      ? "completed"
      : finalState === "recording" && transcript.length > 0
      ? "started"
      : "pending";

  return (
    <div className="flex items-start justify-between gap-2 px-1">
      <Step
        label="Transcript"
        status={transcriptStatus}
        isActive={finalState === "recording"}
      />
      <div className="flex-1 mt-3 border-t border-dashed border-border" />
      <Step
        label="SOAP"
        status={stages.soap}
        isActive={stages.soap === "started"}
      />
      <div className="flex-1 mt-3 border-t border-dashed border-border" />
      <Step
        label="ICD"
        status={stages.icd}
        isActive={stages.icd === "started"}
      />
      <div className="flex-1 mt-3 border-t border-dashed border-border" />
      <Step
        label="Summary"
        status={stages.summary}
        isActive={stages.summary === "started"}
      />
    </div>
  );
}
