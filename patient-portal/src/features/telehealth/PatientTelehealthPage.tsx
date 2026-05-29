import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { toast } from "@/lib/toast";
import { telehealthApi, type PatientConsent } from "./api/telehealth-api";
import { ConsentBanner } from "./components/ConsentBanner";
import { PatientTelehealthCall } from "./components/PatientTelehealthCall";

export function PatientTelehealthPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const [consent, setConsent] = useState<PatientConsent | null>(null);
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    if (!appointmentId) return;
    setBusy(true);
    try {
      const res = await telehealthApi.consent(appointmentId);
      setConsent(res);
    } catch (e) {
      toast.error("Couldn't start the visit", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Video visit" />
      {!consent ? (
        <ConsentBanner
          busy={busy}
          onAccept={accept}
          onDecline={() => navigate("/")}
        />
      ) : (
        <div className="h-[calc(100vh-180px)] min-h-[420px] rounded-3xl overflow-hidden ring-1 ring-slate-200/80 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.18)] bg-slate-900">
          {busy ? (
            <div className="grid place-items-center h-full text-white">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <PatientTelehealthCall
              roomUrl={consent.daily_room_url}
              token={consent.meeting_token}
            />
          )}
        </div>
      )}
    </>
  );
}
