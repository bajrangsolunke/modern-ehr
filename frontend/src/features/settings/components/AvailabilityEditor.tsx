/**
 * Provider weekly availability editor.
 *
 * Design notes:
 *  - Header has quick templates ("Mon–Fri 9–5", "Mon–Fri 8–5",
 *    "Mon–Sat 8–5", "Clear all") — these are the patterns 90 % of
 *    US outpatient providers actually use.
 *  - Each weekday is a compact row: status dot + day name + inline
 *    time pills (one per slot, with the time inputs and a remove
 *    button), plus "Add another time block" for split shifts and a
 *    "Copy hours to…" menu so a provider who configured Monday can
 *    replicate it across the week in one click.
 *  - Off days render as a single-line "Not available · Set hours"
 *    affordance — no big empty card.
 */
import { useMemo, useState } from "react";
import {
  Check,
  ClipboardCopy,
  Loader2,
  Moon,
  Plus,
  Trash2,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useApplyHours,
  useAvailability,
  useClearAllHours,
  useCreateSlot,
  useDeleteSlot,
  useUpdateSlot,
} from "@/features/settings/hooks/use-availability";
import type {
  AvailabilitySlot,
  DayOfWeek,
} from "@/features/settings/api/availability-api";
import { cn } from "@/lib/utils";

const DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
const WEEKDAYS: DayOfWeek[] = [0, 1, 2, 3, 4];
const WEEKEND: DayOfWeek[] = [5, 6];

interface Props {
  userId: string;
  description?: string;
}

export function AvailabilityEditor({ userId, description }: Props) {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useAvailability(userId);
  const apply = useApplyHours(userId);
  const clearAll = useClearAllHours(userId);
  const [confirmClear, setConfirmClear] = useState(false);

  const byDay = useMemo(() => {
    const buckets: Record<DayOfWeek, AvailabilitySlot[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };
    for (const slot of data ?? []) {
      buckets[slot.dayOfWeek].push(slot);
    }
    for (const day of DAYS) {
      buckets[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return buckets;
  }, [data]);

  const weeklyMinutes = useMemo(() => {
    let total = 0;
    for (const s of data ?? []) {
      if (!s.isActive) continue;
      total += minutesBetween(s.startTime, s.endTime);
    }
    return total;
  }, [data]);

  const applyTemplate = (label: string, days: DayOfWeek[], start: string, end: string) => {
    void label;
    apply.mutate({ days, startTime: start, endTime: end });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Weekly availability</CardTitle>
            <p className="text-xs text-muted-foreground mt-1 max-w-lg">
              {description ??
                "These are the hours you accept appointments. The scheduler uses them to suggest open slots to staff."}
            </p>
          </div>
          <Badge variant="info" size="sm" className="shrink-0">
            {(weeklyMinutes / 60).toFixed(1)} h/week
          </Badge>
        </CardHeader>
        <CardContent className="pb-5 space-y-4">
          {/* Quick templates */}
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-border/60">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">
              Quick start
            </span>
            <TemplateChip
              label="Mon–Fri 9–5"
              onClick={() => applyTemplate("9-5 weekdays", WEEKDAYS, "09:00", "17:00")}
              disabled={apply.isPending}
            />
            <TemplateChip
              label="Mon–Fri 8–5"
              onClick={() => applyTemplate("8-5 weekdays", WEEKDAYS, "08:00", "17:00")}
              disabled={apply.isPending}
            />
            <TemplateChip
              label="Mon–Sat 8–5"
              onClick={() =>
                applyTemplate("8-5 Mon–Sat", [...WEEKDAYS, 5] as DayOfWeek[], "08:00", "17:00")
              }
              disabled={apply.isPending}
            />
            {apply.isPending && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Applying…
              </span>
            )}
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmClear(true)}
                disabled={clearAll.isPending || (data?.length ?? 0) === 0}
                className="text-muted-foreground hover:text-danger"
              >
                {clearAll.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Clear all
              </Button>
            </div>
          </div>

          {/* Loading / error */}
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          )}

          {isError && !isLoading && (
            <ErrorBanner
              title="Couldn't load availability"
              message={error instanceof Error ? error.message : "Please try again."}
              onRetry={() => refetch()}
              retrying={isFetching}
            />
          )}

          {/* Day rows */}
          {!isLoading && !isError && (
            <div className="rounded-2xl border border-border overflow-hidden">
              {DAYS.map((day, idx) => (
                <DayRow
                  key={day}
                  day={day}
                  slots={byDay[day]}
                  hasNeighbor={idx < DAYS.length - 1}
                  userId={userId}
                  applyTo={(targetDays) => {
                    const first = byDay[day][0];
                    if (!first) return;
                    apply.mutate({
                      days: targetDays,
                      startTime: first.startTime,
                      endTime: first.endTime,
                    });
                  }}
                  busy={apply.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear all hours?"
        description="Every weekly availability slot will be removed. You can add hours back any time."
        confirmLabel="Clear all"
        destructive
        busy={clearAll.isPending}
        onConfirm={async () => {
          await clearAll.mutateAsync();
          setConfirmClear(false);
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Day row                                                                    */
/* -------------------------------------------------------------------------- */

function DayRow({
  day,
  slots,
  hasNeighbor,
  userId,
  applyTo,
  busy,
}: {
  day: DayOfWeek;
  slots: AvailabilitySlot[];
  hasNeighbor: boolean;
  userId: string;
  applyTo: (days: DayOfWeek[]) => void;
  busy: boolean;
}) {
  const create = useCreateSlot(userId);
  const hasAny = slots.length > 0;

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition",
        hasNeighbor && "border-b border-border/60",
        hasAny ? "bg-white" : "bg-surface-subtle/40"
      )}
    >
      {/* Day label column */}
      <div className="w-28 flex items-center gap-2 pt-2 shrink-0">
        <span
          className={cn(
            "size-2 rounded-full",
            hasAny ? "bg-success" : "bg-slate-300"
          )}
        />
        <div>
          <div className="font-semibold text-sm leading-tight">{DAY_FULL[day]}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {DAY_SHORT[day]}
          </div>
        </div>
      </div>

      {/* Slot pills column */}
      <div className="flex-1 min-w-0">
        {hasAny ? (
          <div className="flex flex-wrap items-center gap-2">
            {slots.map((slot) => (
              <SlotPill key={slot.id} slot={slot} userId={userId} />
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground hover:text-foreground"
              onClick={() =>
                create.mutate({
                  day_of_week: day,
                  start_time: defaultNextStart(slots),
                  end_time: defaultNextEnd(slots),
                  is_active: true,
                })
              }
              disabled={create.isPending || busy}
            >
              <Plus className="size-3.5" /> Add another time block
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground py-2 ring-focus rounded-lg"
            onClick={() =>
              create.mutate({
                day_of_week: day,
                start_time: "09:00",
                end_time: "17:00",
                is_active: true,
              })
            }
            disabled={create.isPending || busy}
          >
            <Moon className="size-3.5" />
            <span>Not available · </span>
            <span className="text-primary font-medium">Set hours</span>
          </button>
        )}
      </div>

      {/* Copy menu */}
      {hasAny && (
        <CopyMenu
          fromDay={day}
          onApply={applyTo}
          disabled={busy || create.isPending}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Slot pill                                                                  */
/* -------------------------------------------------------------------------- */

function SlotPill({
  slot,
  userId,
}: {
  slot: AvailabilitySlot;
  userId: string;
}) {
  const update = useUpdateSlot(userId);
  const remove = useDeleteSlot(userId);
  const [start, setStart] = useState(slot.startTime);
  const [end, setEnd] = useState(slot.endTime);

  const dirty = start !== slot.startTime || end !== slot.endTime;
  const invalid = dirty && start >= end;

  const commit = () => {
    if (!dirty || invalid) return;
    update.mutate({ id: slot.id, input: { start_time: start, end_time: end } });
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border bg-white pl-2 pr-1 py-0.5 transition",
        invalid ? "border-danger/60" : "border-border"
      )}
    >
      <Input
        type="time"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        onBlur={commit}
        className="h-7 w-[100px] px-2 border-0 shadow-none bg-transparent text-sm font-medium"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="time"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        onBlur={commit}
        className="h-7 w-[100px] px-2 border-0 shadow-none bg-transparent text-sm font-medium"
      />
      {dirty && !invalid && (
        <button
          type="button"
          aria-label="Save change"
          onClick={commit}
          className="size-6 grid place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition"
        >
          {update.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" />
          )}
        </button>
      )}
      <button
        type="button"
        aria-label="Remove slot"
        onClick={() => remove.mutate(slot.id)}
        disabled={remove.isPending}
        className="size-6 grid place-items-center rounded-full text-muted-foreground hover:text-danger hover:bg-danger/10 transition"
      >
        {remove.isPending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Trash2 className="size-3" />
        )}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Copy menu                                                                  */
/* -------------------------------------------------------------------------- */

function CopyMenu({
  fromDay,
  onApply,
  disabled,
}: {
  fromDay: DayOfWeek;
  onApply: (days: DayOfWeek[]) => void;
  disabled: boolean;
}) {
  const otherWeekdays = WEEKDAYS.filter((d) => d !== fromDay);
  const otherDays = DAYS.filter((d) => d !== fromDay);
  const otherWeekend = WEEKEND.filter((d) => d !== fromDay);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full text-muted-foreground hover:text-foreground mt-1.5 shrink-0"
          aria-label="Copy hours to other days"
          title="Copy hours to other days"
          disabled={disabled}
        >
          <ClipboardCopy className="size-3.5" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-52 rounded-2xl bg-white shadow-elev border border-border p-1.5 animate-fade-in"
        >
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Copy hours to…
          </div>
          {otherWeekdays.length > 0 && (
            <MenuItem onSelect={() => onApply(otherWeekdays)}>
              Other weekdays (Mon–Fri)
            </MenuItem>
          )}
          {otherWeekend.length > 0 && (
            <MenuItem onSelect={() => onApply(otherWeekend)}>
              Weekend (Sat–Sun)
            </MenuItem>
          )}
          <MenuItem onSelect={() => onApply(otherDays)}>All other days</MenuItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl cursor-pointer outline-none hover:bg-secondary text-foreground"
    >
      {children}
    </DropdownMenu.Item>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function TemplateChip({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-3 h-8 rounded-full text-xs font-medium border border-border bg-white",
        "text-foreground/80 hover:text-foreground hover:border-foreground/30",
        "transition ring-focus disabled:opacity-60 disabled:cursor-not-allowed"
      )}
    >
      {label}
    </button>
  );
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

/**
 * When the user adds another block to an already-active day, default
 * to "right after lunch" (13:00) if no slot covers it, otherwise jump
 * 30 min after the last slot. Tries to do the boring thing
 * automatically so the provider just confirms.
 */
function defaultNextStart(slots: AvailabilitySlot[]): string {
  if (slots.length === 0) return "09:00";
  const lastEnd = slots
    .map((s) => s.endTime)
    .sort()
    .pop()!;
  // Bump by 30 min as a reasonable lunch gap.
  return addMinutes(lastEnd, 60);
}

function defaultNextEnd(slots: AvailabilitySlot[]): string {
  const start = defaultNextStart(slots);
  return addMinutes(start, 240); // 4-hour afternoon block by default.
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + mins);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
