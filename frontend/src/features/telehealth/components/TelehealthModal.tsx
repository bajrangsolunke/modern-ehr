/**
 * The provider's telehealth call window — a Daily iframe on the left,
 * <LiveTranscript> on the right, with End / Generate SOAP buttons
 * along the bottom.
 *
 * Transcription:
 *   1. Provider clicks "Start visit" → we mint a session + token.
 *   2. Daily iframe joins the room with `subscribeToTracksAutomatically`.
 *   3. We call `startTranscription({ tier: 'nova' })` once the call
 *      object reports `joined-meeting`.
 *   4. Each `transcription-message` event is buffered and flushed to
 *      the backend in 1.5s windows so we don't post once per word.
 *
 * The local buffer is the source of truth for the FE display until
 * the backend poll catches up — keeps the UX feeling instant even on
 * slow networks.
 */
import { useEffect, useRef, useState } from "react";
import DailyIframe, {
  type DailyCall,
  type DailyEventObjectTranscriptionMessage,
} from "@daily-co/daily-js";
import { Loader2, PhoneOff, Sparkles, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  useEndTelehealth,
  useGenerateSoap,
  useTranscript,
} from "../hooks/use-telehealth";
import {
  type SoapDraft,
  type TelehealthSessionWithToken,
  type TranscriptSegmentIn,
  telehealthApi,
} from "../api/telehealth-api";
import { LiveTranscript } from "./LiveTranscript";
import {
  isWebSpeechSupported,
  startWebSpeechTranscription,
} from "../lib/web-speech";
import { toast } from "@/lib/toast";

/**
 * "daily" → use Daily.co's built-in `startTranscription()` (requires
 *           Scale/HIPAA plan with the Transcription add-on).
 * "web-speech" → use the browser's SpeechRecognition API. Free, dev-mode.
 *
 * Default is "web-speech" so the free Daily plan still gets a working
 * SOAP-generation pipeline. Flip to "daily" via env once on a paid plan.
 */
const TRANSCRIPTION_MODE: "daily" | "web-speech" =
  (import.meta.env.VITE_TRANSCRIPTION_MODE as "daily" | "web-speech") ??
  "web-speech";

interface Props {
  open: boolean;
  session: TelehealthSessionWithToken | null;
  /** Current viewer's user id — used so we tag our own transcription
   *  messages as `provider` immediately, without waiting for the
   *  backend to resolve roles. */
  viewerUserId: string | undefined;
  onClose: () => void;
  onDraftGenerated: (draft: SoapDraft) => void;
}

const FLUSH_INTERVAL_MS = 1500;

export function TelehealthModal({
  open,
  session,
  viewerUserId,
  onClose,
  onDraftGenerated,
}: Props) {
  void viewerUserId;
  const callRef = useRef<DailyCall | null>(null);
  const startedAtRef = useRef<number>(0);
  const bufferRef = useRef<TranscriptSegmentIn[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const ownParticipantIdRef = useRef<string | null>(null);
  const webSpeechRef = useRef<{ stop: () => void } | null>(null);
  const [joining, setJoining] = useState(false);

  const end = useEndTelehealth();
  const generate = useGenerateSoap();
  const { data: transcript = [] } = useTranscript(
    session?.id ?? null,
    open && session?.status !== "ended",
  );

  // Mount / unmount the Daily call object alongside the modal.
  useEffect(() => {
    if (!open || !session) return;

    const iframeContainer = document.getElementById("daily-iframe-mount");
    if (!iframeContainer) return;

    // DailyIframe is a strict singleton — a stale instance (from a
    // StrictMode double-mount, HMR, or a previous open/close cycle)
    // makes `createFrame` throw "Duplicate DailyIframe instances are
    // not allowed". Destroy whatever's left over before we mount.
    const stale = DailyIframe.getCallInstance();
    if (stale) {
      void stale.destroy();
    }

    setJoining(true);
    const call = DailyIframe.createFrame(iframeContainer, {
      iframeStyle: {
        width: "100%",
        height: "100%",
        border: "0",
        borderRadius: "12px",
      },
      showLeaveButton: false,
      showFullscreenButton: true,
    });
    callRef.current = call;
    startedAtRef.current = Date.now();

    call.on("joined-meeting", (evt) => {
      setJoining(false);
      ownParticipantIdRef.current = evt?.participants?.local?.session_id ?? null;
      if (TRANSCRIPTION_MODE === "daily") {
        // Daily-Deepgram path — only owners can start; provider's token is_owner=true.
        try {
          call.startTranscription({ tier: "nova" });
        } catch (e) {
          toast.error("Couldn't start transcription", {
            description: e instanceof Error ? e.message : undefined,
          });
        }
      } else {
        // Web Speech dev fallback — captures the local mic only, so we
        // tag everything as `unknown` and let the LLM infer roles from
        // the content during SOAP generation.
        if (!isWebSpeechSupported()) {
          toast.error("Browser doesn't support speech recognition", {
            description:
              "Live transcript needs Chrome or Edge. Use Daily plan with Transcription for cross-browser support.",
          });
        } else {
          webSpeechRef.current = startWebSpeechTranscription({
            onFinal: (text) => {
              const offset = Math.max(0, Date.now() - startedAtRef.current);
              bufferRef.current.push({
                speaker_role: "unknown",
                daily_participant_id: null,
                text,
                start_offset_ms: offset,
              });
            },
            onError: (msg) => {
              toast.error("Transcription error", { description: msg });
            },
          });
        }
      }
    });

    const onTranscript = (evt: DailyEventObjectTranscriptionMessage) => {
      const text = (evt.text || "").trim();
      if (!text) return;
      const offset = Math.max(0, Date.now() - startedAtRef.current);
      const isOwn = evt.participantId === ownParticipantIdRef.current;
      bufferRef.current.push({
        speaker_role: isOwn ? "provider" : "patient",
        daily_participant_id: evt.participantId,
        text,
        start_offset_ms: offset,
      });
    };
    if (TRANSCRIPTION_MODE === "daily") {
      call.on("transcription-message", onTranscript);
    }

    call
      .join({ url: session.dailyRoomUrl, token: session.meetingToken })
      .catch((e) => {
        setJoining(false);
        toast.error("Failed to join the call", {
          description: e instanceof Error ? e.message : undefined,
        });
      });

    flushTimerRef.current = window.setInterval(() => {
      const buf = bufferRef.current;
      if (!buf.length || !session) return;
      bufferRef.current = [];
      telehealthApi
        .appendTranscript(session.id, buf)
        .catch(() => {
          // Don't drop on failure — re-queue at the front so the
          // next flush retries.
          bufferRef.current = [...buf, ...bufferRef.current];
        });
    }, FLUSH_INTERVAL_MS);

    return () => {
      if (flushTimerRef.current !== null) {
        window.clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      webSpeechRef.current?.stop();
      webSpeechRef.current = null;
      if (TRANSCRIPTION_MODE === "daily") {
        call.off("transcription-message", onTranscript);
      }
      call.leave().catch(() => {});
      call.destroy().catch(() => {});
      callRef.current = null;
    };
    // viewerUserId is only used to label; deps stay narrow to avoid
    // re-mounting the call on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.id]);

  const handleEnd = async () => {
    if (!session) return;
    if (TRANSCRIPTION_MODE === "daily") {
      try {
        callRef.current?.stopTranscription();
      } catch {
        /* swallow */
      }
    }
    webSpeechRef.current?.stop();
    webSpeechRef.current = null;
    // Flush any buffered chunks one last time.
    const buf = bufferRef.current;
    if (buf.length > 0) {
      bufferRef.current = [];
      await telehealthApi.appendTranscript(session.id, buf).catch(() => {});
    }
    await end.mutateAsync(session.id);
    onClose();
  };

  const handleGenerate = async () => {
    if (!session) return;
    try {
      const draft = await generate.mutateAsync(session.id);
      onDraftGenerated(draft);
      toast.success("SOAP draft ready", {
        description: "Review and sign in the note drawer.",
      });
    } catch (e) {
      toast.error("Couldn't generate SOAP", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Telehealth visit"
      size="full"
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <Button
            variant="secondary"
            onClick={handleGenerate}
            disabled={generate.isPending}
            className="h-10"
          >
            {generate.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Generate SOAP draft
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} className="h-10">
              <X className="size-4" /> Minimize
            </Button>
            <Button
              onClick={handleEnd}
              disabled={end.isPending}
              className="h-10 bg-danger hover:bg-danger/90"
            >
              {end.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PhoneOff className="size-4" />
              )}
              End visit
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-3 h-[calc(94vh-140px)] min-h-[480px]">
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 min-h-[480px]">
          <div id="daily-iframe-mount" className="absolute inset-0" />
          {joining && (
            <div className="absolute inset-0 grid place-items-center bg-slate-900/80 text-white pointer-events-none">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 min-h-0">
          {TRANSCRIPTION_MODE === "web-speech" && (
            <div className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 leading-snug">
              Dev transcription · single-speaker, Chrome/Edge only.
              Upgrade your Daily plan for multi-speaker Deepgram.
            </div>
          )}
          <div className="flex-1 min-h-0">
            <LiveTranscript segments={transcript} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
