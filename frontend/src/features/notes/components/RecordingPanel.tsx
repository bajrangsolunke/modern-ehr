/**
 * RecordingPanel — ambient scribe panel inside the SoapNotePage.
 * Wraps useStreamingSession + useRecorder, shows waveform + pipeline strip.
 * After completion collapses into a small "Recording complete" toggle.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Mic, MicOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Waveform } from "@/features/scribe/components/Waveform";
import { PipelineStrip } from "@/features/scribe/components/PipelineStrip";
import { useStreamingSession } from "@/features/scribe/hooks/use-streaming-session";
import { useRecorder } from "@/features/scribe/hooks/use-recorder";
import { useScribeSession } from "@/features/scribe/hooks/use-scribe";
import type { ScribeSessionFull } from "@/features/scribe/api/scribe-api";

interface RecordingPanelProps {
  patientId: string;
  onSessionCompleted: (session: ScribeSessionFull) => void;
}

function useElapsedLabel(active: boolean): string {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

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

export function RecordingPanel({ patientId, onSessionCompleted }: RecordingPanelProps) {
  const streaming = useStreamingSession(patientId);
  const recorder = useRecorder({
    chunkMs: 4000,
    onChunk: streaming.uploadChunk,
  });

  const elapsedLabel = useElapsedLabel(recorder.state === "recording");

  // Fetch the full session when streaming completes
  const liveSessionId = streaming.state === "completed" ? streaming.session?.id : undefined;
  const { data: liveFull } = useScribeSession(liveSessionId);

  // Fire callback once the full session data arrives
  const calledRef = useRef(false);
  useEffect(() => {
    if (liveFull && !calledRef.current) {
      calledRef.current = true;
      onSessionCompleted(liveFull);
    }
  }, [liveFull, onSessionCompleted]);

  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const handleStart = async () => {
    await streaming.start();
    await recorder.start();
  };

  const handleStop = () => {
    recorder.stop();
    streaming.stop();
  };

  const isRecording = recorder.state === "recording";
  const isWorking =
    streaming.state === "creating" || streaming.state === "finalizing";
  const isDone = streaming.state === "completed";

  // Collapsed "done" state
  if (isDone) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="py-3 px-4">
          <button
            type="button"
            onClick={() => setTranscriptOpen((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-success w-full text-left"
          >
            {transcriptOpen ? (
              <ChevronDown className="size-4 shrink-0" />
            ) : (
              <ChevronRight className="size-4 shrink-0" />
            )}
            Recording complete
            <span className="text-muted-foreground font-normal ml-1">
              · view transcript
            </span>
          </button>
          {transcriptOpen && streaming.transcript && (
            <div className="mt-3 rounded-xl bg-background border border-border p-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
              {streaming.transcript}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5 pb-5 space-y-4">
        {/* Waveform during recording */}
        {isRecording && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-4">
            <Waveform stream={recorder.stream} className="flex-1" />
            <span className="text-sm font-mono text-primary font-semibold shrink-0">
              {elapsedLabel}
            </span>
          </div>
        )}

        {/* Idle: just the start button */}
        {streaming.state === "idle" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="rounded-full bg-primary/10 p-5">
              <Mic className="size-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Start recording the visit. The AI will transcribe and structure it
              into a SOAP note once you stop.
            </p>
          </div>
        )}

        {/* Error message */}
        {(streaming.error ?? recorder.error) && (
          <p className="text-sm text-destructive rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2">
            {streaming.error ?? recorder.error}
          </p>
        )}

        {/* Controls */}
        <div className="flex gap-3 justify-center">
          {streaming.state === "idle" && (
            <Button
              onClick={handleStart}
              disabled={recorder.state === "recording"}
              size="lg"
              className="gap-2"
            >
              <Mic className="size-4" />
              Start recording
            </Button>
          )}
          {isRecording && (
            <Button
              variant="destructive"
              onClick={handleStop}
              size="lg"
              className="gap-2"
            >
              <MicOff className="size-4" />
              Stop &amp; finalize
            </Button>
          )}
          {isWorking && (
            <Button disabled size="lg">
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
          <PipelineStrip
            stages={streaming.stages}
            finalState={streaming.state}
            transcript={streaming.transcript}
          />
        )}
      </CardContent>
    </Card>
  );
}
