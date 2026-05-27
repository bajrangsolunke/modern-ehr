/**
 * Calendar view for the appointments page. Supports Day, Week, and
 * Month sub-views. The parent owns `mode` + `cursor` (focal date) so
 * it can recompute the list-query date range as the user navigates.
 *
 * Day / Week share a vertical time-axis grid; Month is a classic
 * 7-col date grid with event pills per cell + "+N more" overflow.
 */
import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Appointment, AppointmentStatus } from "@/types";

export type CalendarMode = "day" | "week" | "month";

const STATUS_BG: Record<AppointmentStatus, string> = {
  scheduled: "bg-info/10 border-info/40 text-info",
  confirmed: "bg-info/10 border-info/40 text-info",
  pending: "bg-warning/10 border-warning/40 text-warning",
  completed: "bg-success/10 border-success/40 text-success",
  cancelled: "bg-danger/10 border-danger/40 text-danger opacity-60",
  "no-show": "bg-slate-100 border-slate-300 text-slate-600",
};
const STATUS_DOT: Record<AppointmentStatus, string> = {
  scheduled: "bg-info",
  confirmed: "bg-info",
  pending: "bg-warning",
  completed: "bg-success",
  cancelled: "bg-danger",
  "no-show": "bg-slate-400",
};

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const START_HOUR = 7;
const END_HOUR = 20; // exclusive
const HOUR_PX = 52;

interface Props {
  mode: CalendarMode;
  onModeChange: (m: CalendarMode) => void;
  cursor: Date;
  onCursorChange: (d: Date) => void;
  appointments: Appointment[];
  onEdit: (a: Appointment) => void;
  onNew: (when: Date) => void;
}

export function AppointmentsCalendar({
  mode,
  onModeChange,
  cursor,
  onCursorChange,
  appointments,
  onEdit,
  onNew,
}: Props) {
  const today = useMemo(() => stripTime(new Date()), []);
  const range = useMemo(() => visibleRangeLabel(mode, cursor), [mode, cursor]);

  const goPrev = () => onCursorChange(shift(cursor, mode, -1));
  const goNext = () => onCursorChange(shift(cursor, mode, +1));
  const goToday = () => onCursorChange(new Date());

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <Toolbar
          mode={mode}
          onModeChange={onModeChange}
          range={range}
          onPrev={goPrev}
          onNext={goNext}
          onToday={goToday}
        />

        {mode === "month" ? (
          <MonthGrid
            cursor={cursor}
            today={today}
            appointments={appointments}
            onEdit={onEdit}
            onPickDay={(d) => {
              onModeChange("day");
              onCursorChange(d);
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <div className={mode === "week" ? "min-w-[860px]" : ""}>
              <DayHeaderRow mode={mode} cursor={cursor} today={today} />
              <TimeGrid
                mode={mode}
                cursor={cursor}
                today={today}
                appointments={appointments}
                onEdit={onEdit}
                onNew={onNew}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Toolbar                                                                    */
/* -------------------------------------------------------------------------- */

function Toolbar({
  mode,
  onModeChange,
  range,
  onPrev,
  onNext,
  onToday,
}: {
  mode: CalendarMode;
  onModeChange: (m: CalendarMode) => void;
  range: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-white flex-wrap">
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          className="size-9 rounded-full"
          onClick={onPrev}
          aria-label="Previous"
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
          aria-label="Next"
        >
          <ChevronRight className="size-4" />
        </Button>
        <span className="ml-2 font-semibold text-sm sm:text-base">{range}</span>
      </div>

      <div className="flex items-center gap-2">
        <ModeToggle mode={mode} onChange={onModeChange} />
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: CalendarMode;
  onChange: (m: CalendarMode) => void;
}) {
  const opts: { value: CalendarMode; label: string }[] = [
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
  ];
  return (
    <div className="bg-[#F1F4F9] rounded-full p-1 flex items-center gap-1">
      {opts.map((o) => {
        const active = mode === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "h-8 px-3 rounded-full text-xs font-semibold transition",
              active
                ? "bg-primary-gradient text-white shadow-glow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Day / Week (time-axis grid)                                                */
/* -------------------------------------------------------------------------- */

function DayHeaderRow({
  mode,
  cursor,
  today,
}: {
  mode: CalendarMode;
  cursor: Date;
  today: Date;
}) {
  const days = mode === "day" ? [stripTime(cursor)] : buildWeekDays(cursor);
  const cols = mode === "day" ? "64px 1fr" : "64px repeat(7, minmax(0, 1fr))";
  return (
    <div
      className="grid border-b border-border bg-surface-subtle"
      style={{ gridTemplateColumns: cols }}
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
              {DAY_SHORT[mondayIndex(d)]}
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

function TimeGrid({
  mode,
  cursor,
  today,
  appointments,
  onEdit,
  onNew,
}: {
  mode: CalendarMode;
  cursor: Date;
  today: Date;
  appointments: Appointment[];
  onEdit: (a: Appointment) => void;
  onNew: (when: Date) => void;
}) {
  const days = useMemo(
    () => (mode === "day" ? [stripTime(cursor)] : buildWeekDays(cursor)),
    [mode, cursor]
  );
  const byDay = useMemo(() => bucketByDay(appointments, days), [appointments, days]);
  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) out.push(h);
    return out;
  }, []);
  const gridHeight = (END_HOUR - START_HOUR) * HOUR_PX;
  const cols = mode === "day" ? "64px 1fr" : "64px repeat(7, minmax(0, 1fr))";

  return (
    <div
      className="grid relative"
      style={{ gridTemplateColumns: cols, height: gridHeight }}
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
      {days.map((day, idx) => (
        <DayColumn
          key={day.toISOString()}
          day={day}
          isToday={sameDay(day, today)}
          appointments={byDay[idx]}
          onEdit={onEdit}
          onNew={onNew}
          hours={hours}
        />
      ))}
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
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMinutes = (y / HOUR_PX) * 60;
    const hour = START_HOUR + Math.floor(totalMinutes / 60);
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
      {hours.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-border/60"
          style={{ top: (h - START_HOUR) * HOUR_PX }}
        />
      ))}
      {isToday && <NowLine />}
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
  if (minutesFromStart < -appointment.duration) return null;
  if (minutesFromStart >= (END_HOUR - START_HOUR) * 60) return null;

  const top = Math.max(0, (minutesFromStart / 60) * HOUR_PX);
  const height = Math.max(
    24,
    (appointment.duration / 60) * HOUR_PX - 2
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
/* Month grid                                                                 */
/* -------------------------------------------------------------------------- */

function MonthGrid({
  cursor,
  today,
  appointments,
  onEdit,
  onPickDay,
}: {
  cursor: Date;
  today: Date;
  appointments: Appointment[];
  onEdit: (a: Appointment) => void;
  onPickDay: (d: Date) => void;
}) {
  const { days, currentMonth } = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const byDay = useMemo(
    () => bucketByDay(appointments, days),
    [appointments, days]
  );

  return (
    <div>
      <div
        className="grid border-b border-border bg-surface-subtle"
        style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
      >
        {DAY_SHORT.map((d) => (
          <div
            key={d}
            className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-l border-border first:border-l-0"
          >
            {d}
          </div>
        ))}
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
      >
        {days.map((day, idx) => {
          const inMonth = day.getMonth() === currentMonth;
          const isToday = sameDay(day, today);
          const dayAppts = byDay[idx];
          const visible = dayAppts.slice(0, 3);
          const extra = dayAppts.length - visible.length;
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[110px] border-b border-l border-border/60 p-1.5 transition cursor-pointer",
                !inMonth && "bg-surface-subtle/40 text-muted-foreground",
                isToday && "bg-primary/[0.04]",
                "hover:bg-surface-subtle/80"
              )}
              onClick={() => onPickDay(day)}
            >
              <div
                className={cn(
                  "text-xs font-semibold mb-1 flex items-center justify-between",
                  isToday && "text-primary"
                )}
              >
                <span
                  className={cn(
                    isToday &&
                      "inline-grid place-items-center size-5 rounded-full bg-primary text-primary-foreground text-[10px]"
                  )}
                >
                  {day.getDate()}
                </span>
                {dayAppts.length > 0 && (
                  <span className="text-[9px] text-muted-foreground">
                    {dayAppts.length}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {visible.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(a);
                    }}
                    className={cn(
                      "block w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate ring-focus transition",
                      "bg-white border",
                      STATUS_BG[a.status]
                    )}
                    title={`${a.time} · ${a.patientName}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          STATUS_DOT[a.status]
                        )}
                      />
                      <span className="font-semibold">{a.time}</span>
                      <span className="text-foreground/80 truncate">
                        {a.patientName}
                      </span>
                    </span>
                  </button>
                ))}
                {extra > 0 && (
                  <div className="text-[10px] text-muted-foreground pl-1">
                    +{extra} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Date helpers                                                               */
/* -------------------------------------------------------------------------- */

export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - dow);
  return out;
}

export function rangeForMode(
  mode: CalendarMode,
  cursor: Date
): { start: Date; end: Date } {
  if (mode === "day") {
    const start = stripTime(cursor);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }
  if (mode === "week") {
    const start = startOfWeek(cursor);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }
  // month — fetch the visible grid (covers prev/next month spillover).
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const end = startOfWeek(last);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function buildWeekDays(cursor: Date): Date[] {
  const start = startOfWeek(cursor);
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function buildMonthGrid(cursor: Date): { days: Date[]; currentMonth: number } {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const end = startOfWeek(last);
  end.setDate(end.getDate() + 7);
  const days: Date[] = [];
  const cursor2 = new Date(start);
  while (cursor2 < end) {
    days.push(new Date(cursor2));
    cursor2.setDate(cursor2.getDate() + 1);
  }
  return { days, currentMonth: cursor.getMonth() };
}

function bucketByDay(
  appointments: Appointment[],
  days: Date[]
): Appointment[][] {
  const buckets: Appointment[][] = days.map(() => []);
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const indexByKey = new Map(days.map((d, i) => [dayKey(d), i]));
  for (const a of appointments) {
    const start = new Date(a.startsAt);
    const idx = indexByKey.get(dayKey(start));
    if (idx !== undefined) buckets[idx].push(a);
  }
  for (const b of buckets) {
    b.sort((x, y) => +new Date(x.startsAt) - +new Date(y.startsAt));
  }
  return buckets;
}

function shift(d: Date, mode: CalendarMode, delta: number): Date {
  const out = new Date(d);
  if (mode === "day") out.setDate(out.getDate() + delta);
  else if (mode === "week") out.setDate(out.getDate() + delta * 7);
  else out.setMonth(out.getMonth() + delta);
  return out;
}

function mondayIndex(d: Date): number {
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

function visibleRangeLabel(mode: CalendarMode, cursor: Date): string {
  if (mode === "day") {
    return stripTime(cursor).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  if (mode === "month") {
    return cursor.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }
  const start = startOfWeek(cursor);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
    })} – ${end.getDate()}, ${end.getFullYear()}`;
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
