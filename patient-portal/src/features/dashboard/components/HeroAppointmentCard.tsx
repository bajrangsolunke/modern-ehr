import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  CalendarPlus,
  ShieldCheck,
  Sparkles,
  Timer,
  Video,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { humanWhen } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { DashboardNextAppointment } from "@/features/dashboard/api/dashboard-api";

function useCountdown(iso: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  const diff = target - now;
  if (diff <= 0) return null;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `Starts in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const m = minutes % 60;
    return m ? `Starts in ${hours}h ${m}m` : `Starts in ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? `Starts in 1 day` : `Starts in ${days} days`;
}

export function HeroAppointmentCard({ appt }: { appt: DashboardNextAppointment | null }) {
  const navigate = useNavigate();
  const countdown = useCountdown(appt?.starts_at ?? null);

  if (!appt) {
    return (
      <Card
        className={cn(
          "p-8 rounded-[28px] border-slate-200/70 bg-gradient-to-br from-primary-50/50 via-white to-white",
          "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-18px_rgba(79,140,255,0.25)]"
        )}
      >
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-white shadow-soft grid place-items-center text-primary">
            <CalendarClock className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.1em] text-primary font-bold">
              Next appointment
            </div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">No upcoming visits</div>
            <p className="text-sm text-slate-500 mt-0.5">
              When your provider schedules a visit, it'll appear here.
            </p>
          </div>
          <Button size="sm" onClick={() => navigate("/appointments")}>
            <CalendarPlus className="size-3.5" />
            Book a visit
          </Button>
        </div>
      </Card>
    );
  }

  const providerName = appt.provider_name ?? "Care team";
  const isVirtual =
    (appt.appointment_type ?? "").toLowerCase().includes("video") ||
    (appt.appointment_type ?? "").toLowerCase().includes("virtual") ||
    (appt.appointment_type ?? "").toLowerCase().includes("tele");

  return (
    <Card
      className={cn(
        "relative overflow-hidden p-0 rounded-[28px] border-0 text-white",
        "bg-gradient-to-br from-[#1E3A8A] via-[#3B73E6] to-[#7AB2FF]",
        "shadow-[0_10px_40px_-12px_rgba(59,115,230,0.55),0_2px_4px_rgba(15,23,42,0.06)]"
      )}
    >
      <div
        aria-hidden
        className="absolute -top-20 -right-20 size-64 rounded-full bg-white/12 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-24 -left-16 size-56 rounded-full bg-primary-50/10 blur-3xl"
      />

      <div className="relative p-6 lg:p-7 flex flex-col gap-5">
        {/* Header label */}
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-[11px] font-bold tracking-[0.12em] uppercase">
            <CalendarClock className="size-3" />
            Next appointment
          </div>
          {countdown && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-[11px] font-semibold">
              <Timer className="size-3" />
              {countdown}
            </div>
          )}
        </div>

        {/* Doctor + time */}
        <div className="flex items-start gap-4">
          <UserAvatar
            name={providerName}
            src={appt.provider_avatar_url ?? undefined}
            size="xl"
            className="size-16 ring-4 ring-white/30 shadow-xl"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.1em] text-white/70 font-semibold">
              {appt.specialty ?? "Care team"}
            </div>
            <h2 className="text-[22px] lg:text-[26px] font-bold tracking-tight mt-0.5 leading-tight">
              {providerName}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-2.5 py-1 text-[11.5px] font-semibold">
                {isVirtual ? <Video className="size-3" /> : <CalendarClock className="size-3" />}
                {isVirtual ? "Video consultation" : appt.appointment_type ?? "Visit"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/25 text-white px-2.5 py-1 text-[11.5px] font-semibold">
                <ShieldCheck className="size-3" />
                Insurance verified
              </span>
            </div>
          </div>
          <div className="hidden md:block text-right shrink-0">
            <div className="text-[11px] uppercase tracking-[0.1em] text-white/70 font-semibold">
              When
            </div>
            <div className="text-lg font-bold tabular-nums leading-tight mt-0.5">
              {humanWhen(appt.starts_at)}
            </div>
          </div>
        </div>

        {/* AI prep summary */}
        <div className="rounded-2xl bg-white/12 backdrop-blur border border-white/20 px-4 py-3 flex items-start gap-3">
          <div className="size-8 rounded-xl bg-white/20 grid place-items-center shrink-0">
            <Sparkles className="size-4" />
          </div>
          <div className="text-[12.5px] leading-relaxed text-white/95">
            <span className="font-semibold">AI prep · </span>
            Review your last labs, list 2 questions for your provider, and have your
            insurance card handy. We'll auto-share recent vitals.
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="default"
            className="bg-white text-primary hover:bg-white/95 shadow-md flex-1 sm:flex-initial"
            onClick={() => navigate(`/telehealth/${appt.id}`)}
          >
            <Video className="size-4" />
            Join visit
          </Button>
          <Button
            size="default"
            variant="outline"
            className="bg-white/10 backdrop-blur border-white/30 text-white hover:bg-white/20 hover:border-white/40"
            onClick={() => navigate("/appointments")}
          >
            View details
          </Button>
          <Button
            size="default"
            variant="ghost"
            className="text-white/90 hover:text-white hover:bg-white/10"
            onClick={() => navigate("/appointments")}
          >
            Reschedule
          </Button>
        </div>
      </div>
    </Card>
  );
}
