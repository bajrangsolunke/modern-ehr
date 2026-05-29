/**
 * Provider's full-viewport telehealth experience. Opened in a new tab
 * from AppointmentDetailsModal so the call doesn't compete with the
 * rest of the EHR.
 *
 * Layout: Daily prebuilt UI fills most of the viewport, transcript
 * pane sits in a slim right rail, controls along the bottom. After
 * "Generate SOAP draft" the drawer slides in over the call so the
 * provider can edit + sign without leaving the page.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DailyIframe, {
  type DailyCall,
  type DailyEventObjectTranscriptionMessage,
} from "@daily-co/daily-js";
import {
  ArrowLeft,
  Loader2,
  PhoneOff,
  Sparkles,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/stores/auth-store";
import { LiveTranscript } from "./components/LiveTranscript";
import {
  isWebSpeechSupported,
  startWebSpeechTranscription,
} from "./lib/web-speech";
import {
  useEndTelehealth,
  useGenerateSoap,
  useStartTelehealth,
  useTranscript,
} from "./hooks/use-telehealth";
import {
  type SoapDraft,
  type TelehealthSessionWithToken,
  type TranscriptSegmentIn,
  telehealthApi,
} from "./api/telehealth-api";
import { SoapNoteDrawer } from "@/features/patients/components/SoapNoteDrawer";
import { useAppointment } from "@/features/appointments/hooks/use-appointments";

const FLUSH_INTERVAL_MS = 1500;

const TRANSCRIPTION_MODE: "daily" | "web-speech" =
  (import.meta.env.VITE_TRANSCRIPTION_MODE as "daily" | "web-speech") ??
  "web-speech";

export function ProviderTelehealthPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data: appointment } = useAppointment(appointmentId);
  const startMutation = useStartTelehealth();
  const [session, setSession] = useState<TelehealthSessionWithToken | null>(
    null,
  );
  const [startError, setStartError] = useState<string | null>(null);

  // Kick off the start call exactly once per appointment, even under
  // StrictMode double-effect. `mutateAsync` is idempotent on the
  // server (get_or_create_for_appointment), so a double fire would
  // still return the same session — but skipping the second saves a
  // round-trip and removes a flicker.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!appointmentId || startedRef.current) return;
    startedRef.current = true;
    startMutation
      .mutateAsync(appointmentId)
      .then(setSession)
      .catch((e) =>
        setStartError(e instanceof Error ? e.message : "Failed to start visit"),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  if (startError) {
    return (
      <FullPageMessage
        title="Couldn't start the visit"
        body={startError}
        action={
          <Button onClick={() => navigate("/")} variant="secondary">
            Back to dashboard
          </Button>
        }
      />
    );
  }

  if (!session) {
    return (
      <FullPageMessage
        title="Setting up your visit…"
        body="Provisioning the room and minting your meeting token."
        icon={<Loader2 className="size-6 animate-spin text-white" />}
      />
    );
  }

  return (
    <ActiveVisit
      session={session}
      appointmentId={appointmentId!}
      patientId={appointment?.patientId}
      patientName={appointment?.patientName}
      viewerUserId={user?.id}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Active visit                                                               */
/* -------------------------------------------------------------------------- */

function ActiveVisit({
  session,
  appointmentId,
  patientId,
  patientName,
  viewerUserId,
}: {
  session: TelehealthSessionWithToken;
  appointmentId: string;
  patientId: string | undefined;
  patientName: string | undefined;
  viewerUserId: string | undefined;
}) {
  void viewerUserId;
  void appointmentId;
  const navigate = useNavigate();
  const callRef = useRef<DailyCall | null>(null);
  const startedAtRef = useRef<number>(0);
  const bufferRef = useRef<TranscriptSegmentIn[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const ownParticipantIdRef = useRef<string | null>(null);
  const webSpeechRef = useRef<{ stop: () => void } | null>(null);
  const [joining, setJoining] = useState(true);
  const [draft, setDraft] = useState<SoapDraft | null>(null);
  const [soapOpen, setSoapOpen] = useState(false);

  const end = useEndTelehealth();
  const generate = useGenerateSoap();
  const { data: transcript = [] } = useTranscript(
    session.id,
    session.status !== "ended",
  );

  useEffect(() => {
    const container = document.getElementById("provider-daily-mount");
    if (!container) return;

    // Concurrency story under React StrictMode (dev) + Vite HMR:
    //   1. The effect can fire twice in a row before either cleanup
    //      runs to completion.
    //   2. DailyIframe is a hard singleton — `createFrame` throws
    //      "Duplicate DailyIframe instances are not allowed" if any
    //      instance is in the registry.
    //   3. `destroy()` returns a Promise; on some versions the
    //      registry clear isn't synchronous, so a sync guard
    //      (getCallInstance → destroy → createFrame) still races.
    //
    // We fix it by:
    //   - awaiting `stale.destroy()` before `createFrame`
    //   - tracking the created instance through a closure-scoped
    //     variable so the cleanup function can tear it down even
    //     when setup is still in flight
    //   - a `cancelled` flag so a setup that completes after the
    //     cleanup ran immediately destroys what it created
    let cancelled = false;
    let localCall: DailyCall | null = null;

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

    const setup = async () => {
      const stale = DailyIframe.getCallInstance();
      if (stale) {
        try {
          await stale.destroy();
        } catch {
          /* swallow — best-effort cleanup */
        }
      }
      if (cancelled) return;

      let call: DailyCall;
      try {
        call = DailyIframe.createFrame(container, {
          iframeStyle: {
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            border: "0",
            display: "block",
          },
          showLeaveButton: false,
          showFullscreenButton: true,
        });
      } catch (e) {
        if (!cancelled) {
          toast.error("Couldn't initialize the call", {
            description: e instanceof Error ? e.message : undefined,
          });
        }
        return;
      }

      // If we were cancelled while createFrame was synchronously
      // executing, destroy what we just made and bail.
      if (cancelled) {
        void call.destroy();
        return;
      }

      localCall = call;
      callRef.current = call;
      startedAtRef.current = Date.now();

      call.on("joined-meeting", (evt) => {
        setJoining(false);
        ownParticipantIdRef.current =
          evt?.participants?.local?.session_id ?? null;
        if (TRANSCRIPTION_MODE === "daily") {
          try {
            call.startTranscription({ tier: "nova" });
          } catch (e) {
            toast.error("Couldn't start transcription", {
              description: e instanceof Error ? e.message : undefined,
            });
          }
        } else if (!isWebSpeechSupported()) {
          toast.error("Browser doesn't support speech recognition", {
            description:
              "Live transcript needs Chrome or Edge. Switch browser or upgrade your Daily plan.",
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
      });

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
        if (!buf.length) return;
        bufferRef.current = [];
        telehealthApi.appendTranscript(session.id, buf).catch(() => {
          bufferRef.current = [...buf, ...bufferRef.current];
        });
      }, FLUSH_INTERVAL_MS);
    };

    void setup();

    return () => {
      cancelled = true;
      if (flushTimerRef.current !== null) {
        window.clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      webSpeechRef.current?.stop();
      webSpeechRef.current = null;
      const c = localCall ?? callRef.current;
      if (c) {
        if (TRANSCRIPTION_MODE === "daily") {
          try {
            c.off("transcription-message", onTranscript);
          } catch {
            /* swallow */
          }
        }
        c.leave().catch(() => {});
        c.destroy().catch(() => {});
      }
      callRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const handleEnd = async () => {
    if (TRANSCRIPTION_MODE === "daily") {
      try {
        callRef.current?.stopTranscription();
      } catch {
        /* swallow */
      }
    }
    webSpeechRef.current?.stop();
    webSpeechRef.current = null;
    const buf = bufferRef.current;
    if (buf.length > 0) {
      bufferRef.current = [];
      await telehealthApi.appendTranscript(session.id, buf).catch(() => {});
    }
    try {
      await end.mutateAsync(session.id);
    } catch {
      /* error toast in hook */
    }
    // If this tab was opened by the EHR, close it. Browsers only let
    // us close tabs we opened ourselves; otherwise fall back to nav.
    if (window.opener) {
      window.close();
    } else {
      navigate("/");
    }
  };

  const handleGenerate = async () => {
    try {
      const result = await generate.mutateAsync(session.id);
      setDraft(result);
      setSoapOpen(true);
      toast.success("SOAP draft ready", {
        description: "Review and sign in the drawer.",
      });
    } catch (e) {
      toast.error("Couldn't generate SOAP", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const visitTitle = patientName
    ? `Telehealth visit · ${patientName}`
    : "Telehealth visit";

  return (
    <div className="fixed inset-0 bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="h-14 flex items-center justify-between gap-3 px-5 border-b border-slate-800 bg-slate-900 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Video className="size-5 text-emerald-400 shrink-0" />
          <h1 className="text-base font-semibold truncate">{visitTitle}</h1>
        </div>
        <div className="text-[11px] uppercase tracking-wider text-slate-400">
          Live
        </div>
      </header>

      {/* Main: call + transcript */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-2 p-2">
        <div className="relative rounded-xl overflow-hidden bg-slate-900 ring-1 ring-slate-800">
          <div id="provider-daily-mount" className="absolute inset-0" />
          {joining && (
            <div className="absolute inset-0 grid place-items-center bg-slate-900/90 pointer-events-none">
              <div className="text-center">
                <Loader2 className="size-7 animate-spin mx-auto" />
                <div className="mt-3 text-sm text-slate-300">
                  Connecting to the call…
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-2 min-h-0">
          {TRANSCRIPTION_MODE === "web-speech" && (
            <div className="text-[11px] font-medium text-amber-100 bg-amber-900/40 border border-amber-800/60 rounded-lg px-2.5 py-1.5 leading-snug">
              Dev transcription · single-speaker, Chrome/Edge only.
              Upgrade your Daily plan for multi-speaker Deepgram.
            </div>
          )}
          <div className="flex-1 min-h-0 rounded-xl overflow-hidden bg-slate-900 ring-1 ring-slate-800">
            <LiveTranscript segments={transcript} />
          </div>
        </aside>
      </main>

      {/* Footer controls */}
      <footer className="h-16 flex items-center justify-between gap-3 px-5 border-t border-slate-800 bg-slate-900 shrink-0">
        <Button
          variant="secondary"
          onClick={() => navigate("/")}
          className="h-10 bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
        >
          <ArrowLeft className="size-4" /> Back to EHR
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleGenerate}
            disabled={generate.isPending}
            className="h-10 bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
          >
            {generate.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Generate SOAP draft
          </Button>
          <Button
            onClick={handleEnd}
            disabled={end.isPending}
            className="h-10 bg-red-600 hover:bg-red-700"
          >
            {end.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PhoneOff className="size-4" />
            )}
            End visit
          </Button>
        </div>
      </footer>

      {/* SOAP drawer slides over the call */}
      {patientId && (
        <SoapNoteDrawer
          open={soapOpen}
          onOpenChange={setSoapOpen}
          patientId={patientId}
          prefill={draft}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading / error state                                                      */
/* -------------------------------------------------------------------------- */

function FullPageMessage({
  title,
  body,
  icon,
  action,
}: {
  title: string;
  body: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-slate-950 text-white grid place-items-center p-6">
      <div className="text-center max-w-sm">
        {icon ?? <Video className="size-7 mx-auto text-emerald-400" />}
        <h1 className="mt-4 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">{body}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
