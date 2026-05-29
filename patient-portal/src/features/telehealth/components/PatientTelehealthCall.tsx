/**
 * Patient-side Daily iframe. No transcript pane (patient doesn't
 * need to see captions in this build), no End button — patient
 * leaves the call by closing the tab or hitting the iframe's
 * built-in leave button.
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
    const call = DailyIframe.createFrame(mount, {
      iframeStyle: {
        width: "100%",
        height: "100%",
        border: "0",
        borderRadius: "16px",
      },
      showLeaveButton: true,
      showFullscreenButton: true,
      userName: patientName,
    });
    callRef.current = call;
    call.join({ url: roomUrl, token }).catch(() => {});

    return () => {
      call.leave().catch(() => {});
      call.destroy().catch(() => {});
      callRef.current = null;
    };
  }, [roomUrl, token, patientName]);

  return <div id="patient-daily-mount" className="w-full h-full" />;
}
