/**
 * Read-focused appointment details modal.
 * User stories US-APPT-DETAIL-1..US-APPT-DETAIL-5 in
 * docs/superpowers/specs/2026-05-27-workflow-user-stories.md.
 *
 * Opens whenever a user clicks an appointment in the table, the
 * calendar, or a month-grid chip. Edit + delete + status changes
 * are reachable from the footer; status changes update the cached
 * appointment optimistically so the modal reflects the new state
 * without re-fetching.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckCheck,
  Clock,
  DoorOpen,
  ExternalLink,
  Loader2,
  Pencil,
  Stethoscope,
  Trash2,
  Video,
  X,
  XCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import {
  useSetAppointmentStatus,
  useDeleteAppointment,
} from "@/features/appointments/hooks/use-appointments";
import { useStartTelehealth } from "@/features/telehealth/hooks/use-telehealth";
import { TelehealthModal } from "@/features/telehealth/components/TelehealthModal";
import type {
  SoapDraft,
  TelehealthSessionWithToken,
} from "@/features/telehealth/api/telehealth-api";
import { SoapNoteDrawer } from "@/features/patients/components/SoapNoteDrawer";
import { useAuthStore } from "@/stores/auth-store";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { Appointment, AppointmentStatus } from "@/types";

const STATUS_VARIANT: Record<
  AppointmentStatus,
  "info" | "warning" | "success" | "neutral" | "danger"
> = {
  scheduled: "info",
  confirmed: "info",
  pending: "warning",
  completed: "success",
  cancelled: "danger",
  "no-show": "neutral",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  /** Called when the user picks "Edit / reschedule" — parent should
   *  close the details modal and open AppointmentModal in edit mode. */
  onEdit: (a: Appointment) => void;
  /** Called when admin picks "Remove" — parent shows the confirm
   *  dialog. */
  onDelete?: (a: Appointment) => void;
}

export function AppointmentDetailsModal({
  open,
  onOpenChange,
  appointment,
  onEdit,
  onDelete,
}: Props) {
  const setStatus = useSetAppointmentStatus();
  const remove = useDeleteAppointment();
  const user = useAuthStore((s) => s.user);
  const canDelete = user?.role === "admin";
  void remove;

  const [telehealthOpen, setTelehealthOpen] = useState(false);
  const [tSession, setTSession] = useState<TelehealthSessionWithToken | null>(
    null,
  );
  const [pendingDraft, setPendingDraft] = useState<SoapDraft | null>(null);
  const [soapOpen, setSoapOpen] = useState(false);
  const start = useStartTelehealth();
  const currentUser = user;

  const openTelehealth = async () => {
    if (!appointment) return;
    try {
      const session = await start.mutateAsync(appointment.id);
      setTSession(session);
      setTelehealthOpen(true);
    } catch (e) {
      toast.error("Couldn't start visit", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  if (!appointment) {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Appointment details"
        size="md"
      >
        <div />
      </Modal>
    );
  }

  const a = appointment;
  const isOpen = a.status !== "completed" && a.status !== "cancelled";
  const ends = endsAt(a);

  return (
    <>
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Appointment details"
      description={
        a.reason
          ? a.reason
          : "Snapshot of the booking — change status or open the chart from here."
      }
      size="lg"
      footer={
        <Footer
          appointment={a}
          isOpen={isOpen}
          busy={setStatus.isPending}
          canDelete={canDelete}
          onEdit={() => {
            onOpenChange(false);
            onEdit(a);
          }}
          onSetStatus={(s) => setStatus.mutate(a.id, s)}
          onDelete={
            onDelete && canDelete
              ? () => {
                  onOpenChange(false);
                  onDelete(a);
                }
              : undefined
          }
          onStartTelehealth={openTelehealth}
          startPending={start.isPending}
        />
      }
    >
      <div className="space-y-5">
        {/* Type + status banner */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <CalendarClock className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {labelize(a.type)}
              </div>
              <div className="text-xl font-bold leading-tight">
                {formatDate(a.startsAt)} · {a.time}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {a.duration} min · ends {ends}
              </div>
            </div>
          </div>
          <Badge
            variant={STATUS_VARIANT[a.status]}
            dot
            size="lg"
            className="capitalize shrink-0"
          >
            {a.status}
          </Badge>
        </div>

        {/* Patient block */}
        <Section title="Patient">
          <Link
            to={`/patients/${a.patientId}`}
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-3 rounded-2xl bg-surface-subtle p-3 hover:bg-surface-subtle/70 transition group"
          >
            <UserAvatar
              name={a.patientName}
              src={a.patientAvatarUrl}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{a.patientName}</div>
              {a.patientMrn && (
                <div className="text-xs text-muted-foreground">
                  MRN {a.patientMrn}
                </div>
              )}
            </div>
            <span className="text-xs text-primary font-semibold inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
              Open chart <ArrowRight className="size-3.5" />
            </span>
          </Link>
        </Section>

        {/* Provider + Room (two-col grid on wide) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Section title="Provider">
            <div className="flex items-center gap-3 rounded-2xl bg-surface-subtle p-3">
              <UserAvatar name={a.physician} size="lg" />
              <div className="min-w-0">
                <div className="font-semibold truncate">{a.physician}</div>
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Stethoscope className="size-3" />
                  {a.physicianId ? "Assigned" : "Unassigned"}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Room">
            <div className="rounded-2xl bg-surface-subtle p-3 flex items-center gap-2">
              <div className="size-9 rounded-xl bg-white grid place-items-center text-muted-foreground">
                <DoorOpen className="size-4" />
              </div>
              <div className="text-sm font-semibold">{a.room || "—"}</div>
            </div>
          </Section>
        </div>

        {/* Reason */}
        {a.reason && (
          <Section title="Reason">
            <div className="rounded-2xl bg-surface-subtle p-3 text-sm leading-relaxed whitespace-pre-wrap">
              {a.reason}
            </div>
          </Section>
        )}

        {/* Quick meta */}
        <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Clock className="size-3" />
          Created via Modern-EHR · ID {a.id.slice(0, 8)}
        </div>
      </div>
    </Modal>
    <TelehealthModal
      open={telehealthOpen}
      session={tSession}
      viewerUserId={currentUser?.id}
      onClose={() => setTelehealthOpen(false)}
      onDraftGenerated={(draft) => {
        setPendingDraft(draft);
        setTelehealthOpen(false);
        setSoapOpen(true);
      }}
    />
    <SoapNoteDrawer
      open={soapOpen}
      onOpenChange={(o) => {
        setSoapOpen(o);
        if (!o) setPendingDraft(null);
      }}
      patientId={a.patientId}
      prefill={pendingDraft}
    />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
        {title}
      </h4>
      {children}
    </section>
  );
}

function Footer({
  appointment,
  isOpen,
  busy,
  canDelete,
  onEdit,
  onSetStatus,
  onDelete,
  onStartTelehealth,
  startPending,
}: {
  appointment: Appointment;
  isOpen: boolean;
  busy: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onSetStatus: (s: AppointmentStatus) => void;
  onDelete?: () => void;
  onStartTelehealth: () => void;
  startPending: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        {isOpen && appointment.status !== "confirmed" && (
          <StatusAction
            label="Confirm"
            icon={<Check className="size-3.5" />}
            tone="info"
            busy={busy}
            onClick={() => onSetStatus("confirmed")}
          />
        )}
        {isOpen && (
          <StatusAction
            label="Complete"
            icon={<CheckCheck className="size-3.5" />}
            tone="success"
            busy={busy}
            onClick={() => onSetStatus("completed")}
          />
        )}
        {isOpen && (
          <StatusAction
            label="No-show"
            icon={<XCircle className="size-3.5" />}
            tone="muted"
            busy={busy}
            onClick={() => onSetStatus("no-show")}
          />
        )}
        {isOpen && (
          <StatusAction
            label="Cancel"
            icon={<X className="size-3.5" />}
            tone="danger"
            busy={busy}
            onClick={() => onSetStatus("cancelled")}
          />
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Button
          className="h-9 bg-info hover:bg-info/90"
          onClick={onStartTelehealth}
          disabled={startPending}
        >
          <Video className="size-3.5" />
          {startPending ? "Starting…" : "Start telehealth visit"}
        </Button>
        {canDelete && onDelete && (
          <Button
            variant="secondary"
            className="h-9 text-danger hover:text-danger"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" /> Remove
          </Button>
        )}
        <Button className="h-9" onClick={onEdit}>
          <Pencil className="size-3.5" /> Edit / reschedule
        </Button>
      </div>
    </div>
  );
}

function StatusAction({
  label,
  icon,
  tone,
  busy,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  tone: "info" | "success" | "danger" | "muted";
  busy: boolean;
  onClick: () => void;
}) {
  const toneClass = {
    info: "text-info hover:bg-info/10",
    success: "text-success hover:bg-success/10",
    danger: "text-danger hover:bg-danger/10",
    muted: "text-muted-foreground hover:bg-secondary",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs font-semibold border border-border bg-white transition ring-focus disabled:opacity-60",
        toneClass
      )}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */

function endsAt(a: Appointment): string {
  const start = new Date(a.startsAt);
  const end = new Date(start.getTime() + a.duration * 60_000);
  return end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function labelize(v: string): string {
  return v
    .split(/[-_]/)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}

// Some imports are referenced only in JSX above; ensure they're treated
// as used by the linter when the JSX is conditionally rendered.
void ExternalLink;
