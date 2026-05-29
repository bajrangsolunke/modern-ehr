/**
 * Pre-call consent screen. Patient must read + accept before we
 * release the Daily join token. The text below is intentionally
 * plain-English — check with legal before production.
 */
import { ShieldCheck, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  providerName?: string;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function ConsentBanner({
  providerName = "your care team",
  busy = false,
  onAccept,
  onDecline,
}: Props) {
  return (
    <div className="max-w-xl mx-auto rounded-3xl bg-white ring-1 ring-slate-200/80 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.18)] p-8 space-y-5">
      <div className="flex items-center gap-3">
        <span className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
          <Video className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Telehealth visit with {providerName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Before you join, please review the consent below.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm leading-relaxed space-y-2">
        <p className="font-semibold inline-flex items-center gap-2">
          <ShieldCheck className="size-4 text-success" />
          This visit will be transcribed for your medical record.
        </p>
        <p className="text-muted-foreground">
          The audio is converted to text in real time and saved to your chart.
          The video itself is <strong>not</strong> recorded. You can leave the
          call at any time. The transcript is treated as protected health
          information and stored under the same HIPAA safeguards as the rest
          of your chart.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={onDecline} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={onAccept} disabled={busy} className="h-10">
          I accept — join the visit
        </Button>
      </div>
    </div>
  );
}
