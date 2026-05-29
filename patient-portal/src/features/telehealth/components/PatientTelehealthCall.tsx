/**
 * Patient-side Daily iframe. No transcript pane (patient doesn't
 * need to see captions in this build), no End button — patient
 * leaves the call by closing the tab or hitting the iframe's
 * built-in leave button.
 *
 * StrictMode + HMR notes: DailyIframe is a hard singleton and its
 * `destroy()` is async. We await stale teardown, use a cancelled
 * flag, and track the created instance through a closure-scoped
 * variable so the cleanup function can tear it down even when setup
 * is still in flight.
 */
import { useEffect, useRef } from "react";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";

interface Props {
  roomUrl: string;
  token: string;
  patientName?: string;
}

export function PatientTelehealthCall({
  roomUrl,
  token,
  patientName,
}: Props) {
  const callRef = useRef<DailyCall | null>(null);

  useEffect(() => {
    const mount = document.getElementById("patient-daily-mount");
    if (!mount) return;

    let cancelled = false;
    let localCall: DailyCall | null = null;

    const setup = async () => {
      const stale = DailyIframe.getCallInstance();
      if (stale) {
        try {
          await stale.destroy();
        } catch {
          /* swallow */
        }
      }
      if (cancelled) return;

      let call: DailyCall;
      try {
        call = DailyIframe.createFrame(mount, {
          iframeStyle: {
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            border: "0",
            borderRadius: "16px",
            display: "block",
          },
          showLeaveButton: true,
          showFullscreenButton: true,
          userName: patientName,
        });
      } catch {
        return;
      }
      if (cancelled) {
        void call.destroy();
        return;
      }

      localCall = call;
      callRef.current = call;
      call.join({ url: roomUrl, token }).catch(() => {});
    };

    void setup();

    return () => {
      cancelled = true;
      const c = localCall ?? callRef.current;
      if (c) {
        c.leave().catch(() => {});
        c.destroy().catch(() => {});
      }
      callRef.current = null;
    };
  }, [roomUrl, token, patientName]);

  return <div id="patient-daily-mount" className="relative w-full h-full" />;
}
