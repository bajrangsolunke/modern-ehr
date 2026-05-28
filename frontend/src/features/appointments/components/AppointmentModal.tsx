/**
 * Modal-based appointment booking with availability-driven slot picking.
 *
 * Flow:
 *  1. pick patient (live search)
 *  2. pick type + duration (defaults: consultation · 30 min)
 *  3. pick date (default: today)
 *  4. optionally narrow to one provider — otherwise the slot grid is
 *     fed by /appointments/slots in round-robin order across every
 *     active provider with availability that day.
 *  5. pick a slot → physician_id + starts_at + duration are locked
 *
 * Editing an existing appointment falls back to the older "free-form
 * date + time + duration" inputs because reschedules don't necessarily
 * land on an availability slot (the originating booking may predate
 * the provider's current schedule).
 */
import { useMemo, useState } from "react";
import { ChevronDown, Clock, Loader2, Search } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { useForm, zodResolver, z, mapApiError } from "@/lib/form";
import { usePatients } from "@/features/patients/hooks/use-patients";
import { useAssignableUsers } from "@/features/users/hooks/use-users";
import {
  useAvailableSlots,
  useCreateAppointment,
  useUpdateAppointment,
} from "@/features/appointments/hooks/use-appointments";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Appointment } from "@/types";
import { cn } from "@/lib/utils";

const TYPES = [
  "consultation",
  "surgery",
  "diagnosis",
  "biopsy",
  "follow-up",
] as const;
const STATUSES = [
  "scheduled",
  "confirmed",
  "pending",
  "completed",
  "cancelled",
  "no-show",
] as const;
const DURATIONS = [15, 30, 45, 60, 90, 120, 180] as const;

const editSchema = z.object({
  patient_id: z.string().min(1, "Pick a patient"),
  physician_id: z.string().optional().or(z.literal("")),
  type: z.enum(TYPES),
  status: z.enum(STATUSES),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  duration_minutes: z.string().min(1, "Pick a duration"),
  room: z.string().max(64).optional().or(z.literal("")),
  reason: z.string().max(512).optional().or(z.literal("")),
});

type EditValues = z.infer<typeof editSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: Appointment;
  defaultPatientId?: string;
}

export function AppointmentModal({
  open,
  onOpenChange,
  appointment,
  defaultPatientId,
}: Props) {
  return appointment ? (
    <EditAppointmentModal
      key={appointment.id}
      open={open}
      onOpenChange={onOpenChange}
      appointment={appointment}
    />
  ) : (
    <BookAppointmentModal
      open={open}
      onOpenChange={onOpenChange}
      defaultPatientId={defaultPatientId}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Create / Book                                                              */
/* -------------------------------------------------------------------------- */

function BookAppointmentModal({
  open,
  onOpenChange,
  defaultPatientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPatientId?: string;
}) {
  const create = useCreateAppointment();
  const [patientId, setPatientId] = useState<string>(defaultPatientId ?? "");
  const [type, setType] = useState<(typeof TYPES)[number]>("consultation");
  const [duration, setDuration] = useState<number>(30);
  const [date, setDate] = useState<string>(toDateInput(new Date()));
  const [physicianId, setPhysicianId] = useState<string>(""); // empty = any
  const [room, setRoom] = useState("");
  const [reason, setReason] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<{
    startsAt: string;
    physicianId: string;
  } | null>(null);

  // Memoize the slots query so its identity only changes when an
  // actual input does — otherwise every keystroke in reason/room would
  // re-hash the React Query key.
  const slotsQuery = useMemo(
    () => ({
      date,
      duration,
      physician_id: physicianId || undefined,
    }),
    [date, duration, physicianId]
  );
  const { data: slots, isLoading: slotsLoading } = useAvailableSlots(
    slotsQuery,
    open && Boolean(date)
  );

  // Flat list with a pre-formatted display time per row — the grid
  // renders all slots in one continuous row without hour headings.
  const flatSlots = useMemo(
    () =>
      (slots ?? []).map((s) => {
        const d = new Date(s.startsAt);
        return {
          ...s,
          time: d.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
        };
      }),
    [slots]
  );
  const canSubmit = Boolean(patientId && selectedSlot);

  const handleBook = async () => {
    if (!patientId || !selectedSlot) return;
    try {
      await create.mutateAsync({
        patient_id: patientId,
        physician_id: selectedSlot.physicianId,
        type,
        status: "scheduled",
        starts_at: selectedSlot.startsAt,
        duration_minutes: duration,
        room: room || null,
        reason: reason || null,
      });
      onOpenChange(false);
      // Reset for next opening.
      setSelectedSlot(null);
      setReason("");
      setRoom("");
    } catch {
      /* error toast handled in hook */
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New appointment"
      description="Pick a patient, then a slot from the providers' availability."
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleBook}
            disabled={!canSubmit || create.isPending}
          >
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            {create.isPending ? "Booking…" : "Confirm booking"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Step 1: patient */}
        <Section title="1 · Patient" required>
          <PatientPicker value={patientId} onChange={setPatientId} />
        </Section>

        {/* Step 2: type + duration */}
        <Section title="2 · Visit type">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Type" htmlFor="modal-type">
              <Select
                id="modal-type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value as (typeof TYPES)[number]);
                  setSelectedSlot(null);
                }}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {labelize(t)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Duration" htmlFor="modal-duration">
              <Select
                id="modal-duration"
                value={duration}
                onChange={(e) => {
                  setDuration(Number(e.target.value));
                  setSelectedSlot(null);
                }}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d < 60 ? `${d} min` : `${d / 60} h`}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </Section>

        {/* Step 3: date + provider */}
        <Section title="3 · When & who">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Date" htmlFor="modal-date">
              <Input
                id="modal-date"
                type="date"
                value={date}
                min={toDateInput(new Date())}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSelectedSlot(null);
                }}
              />
            </FormField>
            <FormField
              label="Provider"
              htmlFor="modal-provider"
              hint="Leave on 'Any available' to round-robin across providers."
            >
              <ProviderPicker
                value={physicianId}
                onChange={(id) => {
                  setPhysicianId(id);
                  setSelectedSlot(null);
                }}
              />
            </FormField>
          </div>
        </Section>

        {/* Step 4: slot picker */}
        <Section title="4 · Pick a slot" required>
          <SlotGrid
            slots={flatSlots}
            loading={slotsLoading}
            selected={selectedSlot}
            onSelect={setSelectedSlot}
          />
        </Section>

        {/* Step 5: optional context */}
        <Section title="5 · Details (optional)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Room" htmlFor="modal-room">
              <Input
                id="modal-room"
                placeholder="OR-04"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
              />
            </FormField>
            <FormField label="Reason" htmlFor="modal-reason">
              <Input
                id="modal-reason"
                placeholder="Follow-up · post-op week 2"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </FormField>
          </div>
        </Section>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Edit                                                                       */
/* -------------------------------------------------------------------------- */

function EditAppointmentModal({
  open,
  onOpenChange,
  appointment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment;
}) {
  const update = useUpdateAppointment();

  const d = new Date(appointment.startsAt);
  const initial: EditValues = {
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

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: initial,
    values: initial,
  });

  const physicianId = watch("physician_id");

  const onSubmit = handleSubmit(async (values) => {
    const startsAt = new Date(`${values.date}T${values.time}`).toISOString();
    try {
      await update.mutateAsync({
        id: appointment.id,
        input: {
          physician_id: values.physician_id || null,
          type: values.type,
          status: values.status,
          starts_at: startsAt,
          duration_minutes: Number(values.duration_minutes),
          room: values.room || null,
          reason: values.reason || null,
        },
      });
      onOpenChange(false);
    } catch (err) {
      mapApiError(err, setError);
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit appointment"
      description="Reschedule, reassign, or change status."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={update.isPending}
          >
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={update.isPending}>
            {update.isPending && <Loader2 className="size-4 animate-spin" />}
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="Patient">
          <div className="flex items-center gap-2 rounded-full border border-border bg-white shadow-soft px-3 h-10">
            <UserAvatar
              name={appointment.patientName}
              src={appointment.patientAvatarUrl}
              size="sm"
            />
            <span className="text-sm font-medium">{appointment.patientName}</span>
            {appointment.patientMrn && (
              <span className="text-xs text-muted-foreground">
                MRN {appointment.patientMrn}
              </span>
            )}
          </div>
        </FormField>

        <FormField
          label="Provider"
          htmlFor="edit-provider"
          error={errors.physician_id?.message}
        >
          <ProviderPicker
            value={physicianId || ""}
            onChange={(id) =>
              setValue("physician_id", id, { shouldDirty: true })
            }
          />
          <input type="hidden" {...register("physician_id")} />
        </FormField>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="Type" required htmlFor="edit-type" error={errors.type?.message}>
            <Select id="edit-type" {...register("type")}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {labelize(t)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Status" required htmlFor="edit-status" error={errors.status?.message}>
            <Select id="edit-status" {...register("status")}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {labelize(s)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField label="Date" required htmlFor="edit-date" error={errors.date?.message}>
            <Input id="edit-date" type="date" {...register("date")} />
          </FormField>
          <FormField label="Time" required htmlFor="edit-time" error={errors.time?.message}>
            <Input id="edit-time" type="time" {...register("time")} />
          </FormField>
          <FormField
            label="Duration"
            required
            htmlFor="edit-duration"
            error={errors.duration_minutes?.message}
          >
            <Select id="edit-duration" {...register("duration_minutes")}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} min` : `${d / 60} h`}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="Room" htmlFor="edit-room" error={errors.room?.message}>
            <Input id="edit-room" placeholder="OR-04" {...register("room")} />
          </FormField>
          <FormField label="Reason" htmlFor="edit-reason" error={errors.reason?.message}>
            <Input
              id="edit-reason"
              placeholder="Follow-up · post-op week 2"
              {...register("reason")}
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Pickers                                                                    */
/* -------------------------------------------------------------------------- */

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

  // Only fetch when the dropdown opens, or when a value is set so we
  // can resolve its display name. Skips the patient search until the
  // user actually clicks the picker.
  const { data: searchResults } = usePatients(
    {
      q: debounced || undefined,
      page: 1,
      page_size: 8,
    },
    { enabled: open || Boolean(value) }
  );
  const selected = useMemo(
    () => searchResults?.items.find((p) => p.id === value) ?? null,
    [searchResults, value]
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-full border border-border bg-white px-3 h-10 text-left shadow-soft ring-focus"
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <UserAvatar name={selected.name} src={selected.avatarUrl} size="sm" />
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

function ProviderPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data: providers } = useAssignableUsers({
    role: "provider",
    page: 1,
    page_size: 50,
  });
  return (
    <Select
      id="modal-provider"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Any available (round-robin)</option>
      {(providers?.items ?? []).map((u) => (
        <option key={u.id} value={u.id}>
          {u.fullName} {u.specialty ? `· ${u.specialty}` : ""}
        </option>
      ))}
    </Select>
  );
}

/* -------------------------------------------------------------------------- */
/* Slot grid                                                                  */
/* -------------------------------------------------------------------------- */

interface FlatSlot {
  physicianId: string;
  physicianName: string;
  startsAt: string;
  durationMinutes: number;
  load: number;
  /** Pre-formatted local time, e.g. "9:30 AM". */
  time: string;
}

function SlotGrid({
  slots,
  loading,
  selected,
  onSelect,
}: {
  slots: FlatSlot[];
  loading: boolean;
  selected: { startsAt: string; physicianId: string } | null;
  onSelect: (s: { startsAt: string; physicianId: string }) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-xl" />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-subtle p-6 text-center">
        <Clock className="size-5 text-muted-foreground mx-auto mb-2" />
        <div className="text-sm font-semibold">No availability for this day.</div>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Try another date, or have the provider add a weekly availability
          window in Settings → Availability.
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-[340px] overflow-y-auto pr-1">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {slots.map((s) => {
          const isSelected =
            selected?.startsAt === s.startsAt &&
            selected?.physicianId === s.physicianId;
          return (
            <button
              key={`${s.physicianId}-${s.startsAt}`}
              type="button"
              // Provider + load context lives in the tooltip so the
              // tile stays a single-line time pill.
              title={`${s.time} · ${s.physicianName} · ${loadLabel(s.load)} load`}
              onClick={() =>
                onSelect({
                  startsAt: s.startsAt,
                  physicianId: s.physicianId,
                })
              }
              className={cn(
                "h-10 rounded-xl border bg-white text-sm font-semibold transition ring-focus text-center",
                isSelected
                  ? "border-primary ring-2 ring-primary/30 bg-primary/5 text-primary"
                  : "border-border text-foreground hover:border-foreground/30"
              )}
            >
              {s.time}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function loadLabel(load: number): "Light" | "Busy" | "Heavy" {
  if (load <= 2) return "Light";
  if (load <= 5) return "Busy";
  return "Heavy";
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  required,
  children,
}: {
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1">
        {title}
        {required && <span className="text-danger">*</span>}
      </h3>
      {children}
    </section>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
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
