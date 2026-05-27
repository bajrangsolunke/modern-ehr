import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ui/error-banner";
import {
  useAvailability,
  useCreateSlot,
  useDeleteSlot,
  useUpdateSlot,
} from "@/features/settings/hooks/use-availability";
import type {
  AvailabilitySlot,
  DayOfWeek,
} from "@/features/settings/api/availability-api";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

interface Props {
  /** Pass "me" to manage your own availability; otherwise a user id. */
  userId: string;
  description?: string;
}

export function AvailabilityEditor({ userId, description }: Props) {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useAvailability(userId);
  const create = useCreateSlot(userId);
  const update = useUpdateSlot(userId);
  const remove = useDeleteSlot(userId);

  // Bucket slots by day for the grid.
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <CardTitle>Weekly availability</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {description ??
              "Add the hours you're available each day. Multiple slots per day are fine for split shifts."}
          </p>
        </div>
        <Badge variant="neutral" size="sm">
          {(weeklyMinutes / 60).toFixed(1)} h/week
        </Badge>
      </CardHeader>
      <CardContent className="pb-5">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-2xl" />
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

        {!isLoading && !isError && (
          <div className="space-y-2">
            {(Object.keys(byDay) as unknown as DayOfWeek[]).map((dayKey) => {
              const day = Number(dayKey) as DayOfWeek;
              const slots = byDay[day];
              return (
                <DayRow
                  key={day}
                  day={day}
                  slots={slots}
                  onAdd={() =>
                    create.mutate({
                      day_of_week: day,
                      start_time: "09:00",
                      end_time: "17:00",
                      is_active: true,
                    })
                  }
                  onSave={(slot, patch) =>
                    update.mutate({ id: slot.id, input: patch })
                  }
                  onRemove={(slot) => remove.mutate(slot.id)}
                  busy={
                    create.isPending || update.isPending || remove.isPending
                  }
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DayRow({
  day,
  slots,
  onAdd,
  onSave,
  onRemove,
  busy,
}: {
  day: DayOfWeek;
  slots: AvailabilitySlot[];
  onAdd: () => void;
  onSave: (
    slot: AvailabilitySlot,
    patch: { start_time?: string; end_time?: string; is_active?: boolean }
  ) => void;
  onRemove: (slot: AvailabilitySlot) => void;
  busy: boolean;
}) {
  const hasAny = slots.length > 0;
  const allInactive = hasAny && slots.every((s) => !s.isActive);
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-white p-3",
        !hasAny && "border-dashed bg-surface-subtle"
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Badge
            variant={hasAny && !allInactive ? "info" : "neutral"}
            size="sm"
            className="w-12 justify-center"
          >
            {DAY_LABELS[day]}
          </Badge>
          <span className="text-sm font-medium text-foreground/80">
            {DAY_FULL[day]}
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={onAdd} disabled={busy}>
          <Plus className="size-3.5" /> Add slot
        </Button>
      </div>

      {!hasAny && (
        <div className="text-xs text-muted-foreground py-1.5 px-1">
          Not available · tap <strong>Add slot</strong> to set hours.
        </div>
      )}

      {hasAny && (
        <div className="space-y-1.5">
          {slots.map((slot) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              onSave={(patch) => onSave(slot, patch)}
              onRemove={() => onRemove(slot)}
              busy={busy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SlotRow({
  slot,
  onSave,
  onRemove,
  busy,
}: {
  slot: AvailabilitySlot;
  onSave: (patch: {
    start_time?: string;
    end_time?: string;
    is_active?: boolean;
  }) => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const [start, setStart] = useState(slot.startTime);
  const [end, setEnd] = useState(slot.endTime);
  const dirty = start !== slot.startTime || end !== slot.endTime;
  const invalid = dirty && start >= end;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl bg-surface-subtle px-3 py-2 transition",
        !slot.isActive && "opacity-60"
      )}
    >
      <Input
        type="time"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        className="h-9 w-32 px-3"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="time"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        className="h-9 w-32 px-3"
      />
      <label className="inline-flex items-center gap-1.5 ml-2 text-xs text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          className="rounded border-border accent-primary"
          checked={slot.isActive}
          onChange={(e) => onSave({ is_active: e.target.checked })}
        />
        Active
      </label>
      <div className="ml-auto flex items-center gap-1">
        {dirty && (
          <Button
            size="sm"
            disabled={busy || invalid}
            onClick={() => onSave({ start_time: start, end_time: end })}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full text-danger hover:bg-rose-50"
          aria-label="Remove slot"
          onClick={onRemove}
          disabled={busy}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {invalid && (
        <div className="basis-full text-[11px] text-danger pl-1">
          End time must be after start time.
        </div>
      )}
    </div>
  );
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}
