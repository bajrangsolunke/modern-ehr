/**
 * Week-view calendar for the appointments page.
 *
 * Layout: a fixed time-axis column on the left (every hour from 7am
 * to 8pm) and seven day columns to the right. Each appointment
 * renders as an absolutely-positioned card placed by start time +
 * duration. Click → edit; click empty space in a day → start a new
 * booking prefilled with the clicked time.
 */
import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Appointment, AppointmentStatus } from "@/types";

const STATUS_BG: Record<AppointmentStatus, string> = {
  scheduled: "bg-info/10 border-info/40 text-info",
  confirmed: "bg-info/10 border-info/40 text-info",
  pending: "bg-warning/10 border-warning/40 text-warning",
  completed: "bg-success/10 border-success/40 text-success",
  cancelled: "bg-danger/10 border-danger/40 text-danger opacity-60",
  "no-show": "bg-slate-100 border-slate-300 text-slate-600",
};

const DAY_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const START_HOUR = 7;
const END_HOUR = 20; // exclusive
const HOUR_PX = 56;

interface Props {
  weekStart: Date;
  onWeekStartChange: (d: Date) => void;
  appointments: Appointment[];
  onEdit: (a: Appointment) => void;
  onNew: (when: Date) => void;
}

export function AppointmentsCalendar({
  weekStart,
  onWeekStartChange,
  appointments,
  onEdit,
  onNew,
}: Props) {
  const days = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const today = useMemo(() => stripTime(new Date()), []);

  const range = useMemo(() => formatRange(days[0], days[6]), [days]);

  // Bucket appointments by day index in the visible week.
  const byDay = useMemo(() => {
    const buckets: Appointment[][] = Array.from({ length: 7 }, () => []);
    const weekStartTs = days[0].getTime();
    const weekEndTs = new Date(days[6]);
    weekEndTs.setDate(weekEndTs.getDate() + 1);
    for (const a of appointments) {
      const start = new Date(a.startsAt);
      const ts = start.getTime();
      if (ts < weekStartTs || ts >= weekEndTs.getTime()) continue;
      const dayIdx = mondayIndex(start);
      const matchIdx = days.findIndex(
        (d) =>
          d.getFullYear() === start.getFullYear() &&
          d.getMonth() === start.getMonth() &&
          d.getDate() === start.getDate()
      );
      const idx = matchIdx >= 0 ? matchIdx : dayIdx;
      buckets[idx].push(a);
    }
    return buckets;
  }, [appointments, days]);

  const goPrev = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    onWeekStartChange(d);
  };
  const goNext = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    onWeekStartChange(d);
  };
  const goToday = () => onWeekStartChange(startOfWeek(new Date()));

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <Toolbar
          range={range}
          onPrev={goPrev}
          onNext={goNext}
          onToday={goToday}
        />

        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            <HeaderRow days={days} today={today} />
            <Grid
              days={days}
              today={today}
              byDay={byDay}
              onEdit={onEdit}
              onNew={onNew}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function Toolbar({
  range,
  onPrev,
  onNext,
  onToday,
}: {
  range: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border bg-white">
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          className="size-9 rounded-full"
          onClick={onPrev}
          aria-label="Previous week"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="secondary"
          className="h-9 rounded-full px-4"
          onClick={onToday}
        >
          Today
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="size-9 rounded-full"
          onClick={onNext}
          aria-label="Next week"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="font-semibold text-sm sm:text-base">{range}</div>
      <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground">
        <Legend dot="bg-info" label="Scheduled" />
        <Legend dot="bg-warning" label="Pending" />
        <Legend dot="bg-success" label="Completed" />
        <Legend dot="bg-danger" label="Cancelled" />
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", dot)} />
      <span>{label}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function HeaderRow({ days, today }: { days: Date[]; today: Date }) {
  return (
    <div
      className="grid border-b border-border bg-surface-subtle"
      style={{ gridTemplateColumns: "64px repeat(7, minmax(0, 1fr))" }}
    >
      <div />
      {days.map((d, i) => {
        const isToday = sameDay(d, today);
        return (
          <div
            key={i}
            className={cn(
              "px-3 py-2 text-center border-l border-border",
              isToday && "bg-primary/5"
            )}
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {DAY_SHORT[i]}
            </div>
            <div
              className={cn(
                "text-sm font-bold mt-0.5",
                isToday ? "text-primary" : "text-foreground"
              )}
            >
              {d.getDate()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Grid({
  days,
  today,
  byDay,
  onEdit,
  onNew,
}: {
  days: Date[];
  today: Date;
  byDay: Appointment[][];
  onEdit: (a: Appointment) => void;
  onNew: (when: Date) => void;
}) {
  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) out.push(h);
    return out;
  }, []);

  const gridHeight = (END_HOUR - START_HOUR) * HOUR_PX;

  return (
    <div
      className="grid relative"
      style={{
        gridTemplateColumns: "64px repeat(7, minmax(0, 1fr))",
        height: gridHeight,
      }}
    >
      {/* Time axis */}
      <div className="relative">
        {hours.map((h) => (
          <div
            key={h}
            className="absolute left-0 right-0 text-[10px] text-muted-foreground text-right pr-2"
            style={{ top: (h - START_HOUR) * HOUR_PX - 6, height: HOUR_PX }}
          >
            {formatHour(h)}
          </div>
        ))}
      </div>

      {/* Day columns */}
      {days.map((day, dayIdx) => {
        const isToday = sameDay(day, today);
        return (
          <DayColumn
            key={dayIdx}
            day={day}
            isToday={isToday}
            appointments={byDay[dayIdx]}
            onEdit={onEdit}
            onNew={onNew}
            hours={hours}
          />
        );
      })}
    </div>
  );
}

function DayColumn({
  day,
  isToday,
  appointments,
  onEdit,
  onNew,
  hours,
}: {
  day: Date;
  isToday: boolean;
  appointments: Appointment[];
  onEdit: (a: Appointment) => void;
  onNew: (when: Date) => void;
  hours: number[];
}) {
  const handleEmptyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't fire when clicking an event card.
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMinutes = (y / HOUR_PX) * 60;
    const hour = START_HOUR + Math.floor(totalMinutes / 60);
    // Snap to 30 minutes.
    const minute = Math.floor((totalMinutes % 60) / 30) * 30;
    const slot = new Date(day);
    slot.setHours(hour, minute, 0, 0);
    onNew(slot);
  };

  return (
    <div
      className={cn(
        "relative border-l border-border cursor-cell",
        isToday && "bg-primary/[0.03]"
      )}
      onClick={handleEmptyClick}
    >
      {/* Hour gridlines */}
      {hours.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-border/60"
          style={{ top: (h - START_HOUR) * HOUR_PX }}
        />
      ))}
      {/* Now indicator */}
      {isToday && <NowLine />}

      {/* Events */}
      {appointments.map((a) => (
        <EventCard key={a.id} appointment={a} onEdit={onEdit} />
      ))}
    </div>
  );
}

function NowLine() {
  const now = new Date();
  const minutesSinceStart =
    (now.getHours() - START_HOUR) * 60 + now.getMinutes();
  if (minutesSinceStart < 0 || minutesSinceStart > (END_HOUR - START_HOUR) * 60) {
    return null;
  }
  const top = (minutesSinceStart / 60) * HOUR_PX;
  return (
    <div
      className="absolute left-0 right-0 z-10 pointer-events-none"
      style={{ top }}
    >
      <div className="h-px bg-danger/80" />
      <div className="absolute -left-1 -top-1 size-2 rounded-full bg-danger" />
    </div>
  );
}

function EventCard({
  appointment,
  onEdit,
}: {
  appointment: Appointment;
  onEdit: (a: Appointment) => void;
}) {
  const start = new Date(appointment.startsAt);
  const minutesFromStart =
    (start.getHours() - START_HOUR) * 60 + start.getMinutes();
  // Hide events outside the visible time window — the grid only shows
  // 7am-8pm. (Clamp so something near the edge still shows.)
  if (minutesFromStart < -appointment.duration) return null;
  if (minutesFromStart >= (END_HOUR - START_HOUR) * 60) return null;

  const top = Math.max(0, (minutesFromStart / 60) * HOUR_PX);
  const height = Math.max(
    24,
    (appointment.duration / 60) * HOUR_PX - 2 // 2px gap so adjacent events don't touch
  );

  return (
    <button
      type="button"
      data-event
      onClick={(e) => {
        e.stopPropagation();
        onEdit(appointment);
      }}
      className={cn(
        "absolute left-1 right-1 rounded-lg border text-left px-2 py-1 overflow-hidden ring-focus transition hover:shadow-soft",
        STATUS_BG[appointment.status]
      )}
      style={{ top, height }}
      title={`${appointment.time} · ${appointment.patientName} · ${appointment.physician}`}
    >
      <div className="text-[11px] font-bold truncate leading-tight">
        {appointment.time}
      </div>
      <div className="text-[11px] font-semibold truncate leading-tight">
        {appointment.patientName}
      </div>
      {height >= 56 && (
        <div className="text-[10px] text-foreground/70 truncate mt-0.5 leading-tight">
          {appointment.physician}
        </div>
      )}
      {height >= 78 && appointment.room && (
        <Badge variant="neutral" size="sm" className="mt-1 text-[9px]">
          {appointment.room}
        </Badge>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Date helpers                                                               */
/* -------------------------------------------------------------------------- */

export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Monday = 0 in our display order.
  const dow = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - dow);
  return out;
}

function buildWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function mondayIndex(d: Date): number {
  // 0 = Mon … 6 = Sun
  return (d.getDay() + 6) % 7;
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function formatRange(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.toLocaleDateString(undefined, { month: "long", day: "numeric" })} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  if (sameYear) {
    return `${start.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })} – ${end.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })}, ${end.getFullYear()}`;
  }
  return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
}

void DAY_FULL;
