import { useMemo, useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { useForm, zodResolver, z, mapApiError } from "@/lib/form";
import { usePatients } from "@/features/patients/hooks/use-patients";
import { useUsers } from "@/features/users/hooks/use-users";
import {
  useCreateAppointment,
  useUpdateAppointment,
} from "@/features/appointments/hooks/use-appointments";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Appointment } from "@/types";
import { cn } from "@/lib/utils";

const TYPES = ["consultation", "surgery", "diagnosis", "biopsy", "follow-up"] as const;
const STATUSES = [
  "scheduled",
  "confirmed",
  "pending",
  "completed",
  "cancelled",
  "no-show",
] as const;
const DURATIONS = [15, 30, 45, 60, 90, 120, 180] as const;

const schema = z.object({
  patient_id: z.string().min(1, "Pick a patient"),
  physician_id: z.string().optional().or(z.literal("")),
  type: z.enum(TYPES),
  status: z.enum(STATUSES),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  // Stored as a string because the <select> emits strings; we
  // Number() it in onSubmit. Keeps the RHF resolver types simple.
  duration_minutes: z.string().min(1, "Pick a duration"),
  room: z.string().max(64).optional().or(z.literal("")),
  reason: z.string().max(512).optional().or(z.literal("")),
});

type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an appointment to edit; omit for create. */
  appointment?: Appointment;
  /** Pre-select a patient (e.g. when opening from a patient page). */
  defaultPatientId?: string;
}

export function AppointmentDrawer({
  open,
  onOpenChange,
  appointment,
  defaultPatientId,
}: Props) {
  const isEdit = Boolean(appointment);
  const create = useCreateAppointment();
  const update = useUpdateAppointment();

  const initial = useMemo<Values>(() => {
    if (appointment) {
      const d = new Date(appointment.startsAt);
      return {
        patient_id: appointment.patientId,
        physician_id: appointment.physicianId ?? "",
        type: appointment.type as (typeof TYPES)[number],
        status: appointment.status as (typeof STATUSES)[number],
        date: toDateInput(d),
        time: toTimeInput(d),
        duration_minutes: String(appointment.duration),
        room: appointment.room ?? "",
        reason: appointment.reason ?? "",
      };
    }
    const now = new Date();
    // Snap to the next half-hour for nicer defaults.
    now.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0);
    return {
      patient_id: defaultPatientId ?? "",
      physician_id: "",
      type: "consultation",
      status: "scheduled",
      date: toDateInput(now),
      time: toTimeInput(now),
      duration_minutes: "30",
      room: "",
      reason: "",
    };
  }, [appointment, defaultPatientId]);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial,
    values: initial,
  });

  const patientId = watch("patient_id");
  const physicianId = watch("physician_id");

  const onSubmit = handleSubmit(async (values) => {
    const startsAt = new Date(`${values.date}T${values.time}`).toISOString();
    const payload = {
      patient_id: values.patient_id,
      physician_id: values.physician_id || null,
      type: values.type,
      status: values.status,
      starts_at: startsAt,
      duration_minutes: Number(values.duration_minutes),
      room: values.room || null,
      reason: values.reason || null,
    };
    try {
      if (isEdit && appointment) {
        await update.mutateAsync({ id: appointment.id, input: payload });
      } else {
        await create.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (err) {
      mapApiError(err, setError);
    }
  });

  const submitting = isEdit ? update.isPending : create.isPending;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit appointment" : "New appointment"}
      description={
        isEdit
          ? "Reschedule, reassign, or change status."
          : "Book a slot for a patient. The physician will be notified."
      }
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField
          label="Patient"
          required
          htmlFor="ap-patient"
          error={errors.patient_id?.message}
        >
          <PatientPicker
            value={patientId}
            onChange={(id) =>
              setValue("patient_id", id, { shouldDirty: true, shouldValidate: true })
            }
          />
          <input type="hidden" {...register("patient_id")} />
        </FormField>

        <FormField
          label="Physician"
          htmlFor="ap-physician"
          hint="Optional. Can be assigned later."
          error={errors.physician_id?.message}
        >
          <PhysicianPicker
            value={physicianId || ""}
            onChange={(id) =>
              setValue("physician_id", id, { shouldDirty: true })
            }
          />
          <input type="hidden" {...register("physician_id")} />
        </FormField>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="Type" required htmlFor="ap-type" error={errors.type?.message}>
            <Select id="ap-type" {...register("type")}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {labelize(t)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Status" required htmlFor="ap-status" error={errors.status?.message}>
            <Select id="ap-status" {...register("status")}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {labelize(s)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField label="Date" required htmlFor="ap-date" error={errors.date?.message}>
            <Input id="ap-date" type="date" {...register("date")} />
          </FormField>
          <FormField label="Time" required htmlFor="ap-time" error={errors.time?.message}>
            <Input id="ap-time" type="time" {...register("time")} />
          </FormField>
          <FormField
            label="Duration"
            required
            htmlFor="ap-duration"
            error={errors.duration_minutes?.message}
          >
            <Select id="ap-duration" {...register("duration_minutes")}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} min` : `${d / 60} h`}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="Room" htmlFor="ap-room" error={errors.room?.message}>
            <Input id="ap-room" placeholder="OR-04" {...register("room")} />
          </FormField>
          <FormField label="Reason" htmlFor="ap-reason" error={errors.reason?.message}>
            <Input
              id="ap-reason"
              placeholder="Follow-up · post-op week 2"
              {...register("reason")}
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Schedule"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

function PatientPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(query, 200);

  const { data: searchResults } = usePatients({
    q: debounced || undefined,
    page: 1,
    page_size: 8,
  });
  const { data: selectedPage } = usePatients(
    value && !searchResults?.items.some((p) => p.id === value)
      ? { page: 1, page_size: 1 }
      : { page: 1, page_size: 1 }
  );
  // We need the selected patient's display name. Look in current results.
  const selected = useMemo(() => {
    return (
      searchResults?.items.find((p) => p.id === value) ||
      selectedPage?.items.find((p) => p.id === value) ||
      null
    );
  }, [searchResults, selectedPage, value]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-full border border-border bg-white px-3 h-10 text-left shadow-soft ring-focus"
        )}
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <UserAvatar
              name={selected.name}
              src={selected.avatarUrl}
              size="sm"
            />
            <span className="text-sm font-medium truncate">{selected.name}</span>
            <span className="text-xs text-muted-foreground">MRN {selected.mrn}</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Pick a patient…</span>
        )}
        <ChevronDown className="size-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-2xl border border-border bg-white shadow-elev p-2 animate-fade-in">
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or MRN…"
              className="w-full h-9 rounded-full border border-border bg-white pl-9 pr-3 text-sm ring-focus"
            />
          </div>
          <div className="max-h-64 overflow-y-auto mt-2">
            {(searchResults?.items ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground px-3 py-4 text-center">
                No matches.
              </div>
            )}
            {searchResults?.items.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-2 rounded-xl hover:bg-surface-subtle text-left",
                  value === p.id && "bg-surface-subtle"
                )}
              >
                <UserAvatar name={p.name} src={p.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    MRN {p.mrn} · {p.procedure || "—"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PhysicianPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  // Providers are the most common assignee; admins can also be scheduled
  // if needed.
  const { data: providers } = useUsers({
    role: "provider",
    is_active: true,
    page: 1,
    page_size: 50,
  });

  return (
    <div className="flex items-center gap-2">
      <Select
        id="ap-physician"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Unassigned</option>
        {(providers?.items ?? []).map((u) => (
          <option key={u.id} value={u.id}>
            {u.fullName} {u.specialty ? `· ${u.specialty}` : ""}
          </option>
        ))}
      </Select>
      {value && (
        <Badge variant="info" size="sm" className="shrink-0">
          Assigned
        </Badge>
      )}
    </div>
  );
}

function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { id?: string }
) {
  return (
    <div className="relative">
      <select
        {...props}
        className="h-10 w-full rounded-full border border-border bg-white px-4 pr-9 text-sm shadow-soft ring-focus appearance-none cursor-pointer"
      />
      <ChevronDown className="size-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

function labelize(v: string): string {
  return v
    .split(/[-_]/)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toTimeInput(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
