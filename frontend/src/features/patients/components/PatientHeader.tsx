import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  CalendarClock,
  Copy,
  Info,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  Send,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import { PortraitUploader } from "@/features/patients/components/PortraitUploader";
import { PatientRiskChip } from "./PatientRiskChip";
import { AppointmentModal } from "@/features/appointments/components/AppointmentModal";
import { useUpdatePatient } from "@/features/patients/hooks/use-update-patient";
import { usePortalInvite } from "@/features/patients/hooks/use-portal-invite";
import { usePatientAlerts } from "@/features/patients/hooks/use-patient-alerts";
import type {
  AlertSeverity,
  PatientAlert,
} from "@/features/patients/api/alerts-api";
import { toast } from "@/lib/toast";
import type { Patient } from "@/types";

interface Props {
  patient: Patient;
  onEdit?: () => void;
  onRemove?: () => void;
}

export function PatientHeader({ patient, onEdit, onRemove }: Props) {
  const navigate = useNavigate();
  const update = useUpdatePatient(patient.id);
  const invite = usePortalInvite();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailQueued, setEmailQueued] = useState<boolean>(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Highest-severity unresolved alert for the inline chip in the
  // procedure grid. We deliberately show ONE chip, not the whole
  // strip — the full list is on the chart's alerts tab.
  const { data: alerts = [] } = usePatientAlerts(patient.id);
  const topAlert = pickTopAlert(alerts);

  const dobLabel = patient.dob ? formatDate(patient.dob) : "DOB unknown";
  const sexLabel =
    patient.sex === "F" ? "Female" : patient.sex === "M" ? "Male" : "Other";

  const handleInvite = async () => {
    const result = await invite.mutateAsync(patient.id);
    setInviteUrl(result.setup_url);
    setEmailQueued(result.email_queued);
    if (result.email_queued) {
      toast.success("Invite sent", {
        description: "Setup link was emailed to the patient.",
      });
    }
  };

  const copyUrl = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite URL copied");
  };

  return (
    <div className="space-y-4">
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-5">
          <PortraitUploader
            name={patient.name}
            src={patient.avatarUrl}
            onChange={async (dataUrl) => {
              await update.mutateAsync({ avatar_url: dataUrl });
            }}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-bold tracking-tight truncate">
                    {patient.name}
                  </h2>
                  <Badge variant="default" size="sm">
                    MRN {patient.mrn}
                  </Badge>
                  <PatientRiskChip patientId={patient.id} />
                </div>
                <div className="flex items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-muted-foreground flex-wrap">
                  <Meta icon={<UserIcon className="size-3.5" />}>
                    {sexLabel} · {patient.age}y
                  </Meta>
                  <Meta>DOB {dobLabel}</Meta>
                  {patient.city && (
                    <Meta icon={<MapPin className="size-3.5" />}>
                      {patient.city}
                    </Meta>
                  )}
                  {patient.phone && (
                    <Meta icon={<Phone className="size-3.5" />}>
                      {patient.phone}
                    </Meta>
                  )}
                  {patient.email && (
                    <Meta icon={<Mail className="size-3.5" />}>{patient.email}</Meta>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => navigate(`/messages?patient=${patient.id}`)}
                >
                  <MessageSquare className="size-3.5" /> Message
                </Button>
                <Button size="sm" onClick={() => setScheduleOpen(true)}>
                  <CalendarClock className="size-3.5" /> Schedule visit
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleInvite}
                  disabled={invite.isPending}
                  className="h-9"
                >
                  <Send className="size-3.5" />
                  {invite.isPending ? "Generating…" : "Invite to portal"}
                </Button>
                <HeaderMenu onEdit={onEdit} onRemove={onRemove} />
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-border">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Planned procedure details
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                <ProcKv label="Planned procedure" value={patient.procedure || "—"} />
                <ProcKv
                  label="Surgery date"
                  value={
                    patient.procedureDate ? formatDate(patient.procedureDate) : "—"
                  }
                />
                <ProcKv
                  label="Assigned provider"
                  value={patient.assignedPhysician?.name || "—"}
                />
                <ProcKv
                  label="Alert"
                  value={
                    topAlert ? (
                      <AlertChip alert={topAlert} />
                    ) : (
                      <span className="text-muted-foreground font-normal">
                        —
                      </span>
                    )
                  }
                />
                <ProcKv
                  label="ASA classification"
                  value={patient.asa ? `ASA ${patient.asa}` : "—"}
                />
                <ProcKv
                  label="Status"
                  value={
                    <Badge variant="warning" dot size="sm">
                      Awaiting final clearance
                    </Badge>
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    <AppointmentModal
      open={scheduleOpen}
      onOpenChange={setScheduleOpen}
      defaultPatientId={patient.id}
    />
    {inviteUrl && (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="text-sm font-semibold text-primary mb-1">
          {emailQueued
            ? "✉ Invite sent · or copy the link below"
            : "Patient portal invite ready"}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {emailQueued
            ? "The setup link was emailed to the patient. You can also share it directly."
            : "Share this one-time URL with the patient by email, SMS, or in person. It expires in 24 hours."}
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={inviteUrl}
            className="flex-1 h-9 rounded-full border border-border bg-white px-3 text-xs font-mono ring-focus"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button variant="secondary" size="sm" onClick={copyUrl} className="h-9">
            <Copy className="size-3.5" /> Copy
          </Button>
        </div>
      </div>
    )}
    </div>
  );
}

function HeaderMenu({
  onEdit,
  onRemove,
}: {
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  if (!onEdit && !onRemove) return null;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="size-9 rounded-full bg-secondary hover:bg-secondary/80"
          aria-label="Patient actions"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-44 rounded-2xl bg-white shadow-elev border border-border p-1.5 animate-fade-in"
        >
          {onEdit && (
            <DropdownMenu.Item
              onSelect={onEdit}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl cursor-pointer outline-none hover:bg-secondary text-foreground"
            >
              <Pencil className="size-4" /> Edit patient
            </DropdownMenu.Item>
          )}
          {onRemove && (
            <>
              <DropdownMenu.Separator className="h-px bg-border my-1" />
              <DropdownMenu.Item
                onSelect={onRemove}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl cursor-pointer outline-none hover:bg-danger/10 text-danger"
              >
                <Trash2 className="size-4" /> Remove patient
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Meta({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      <span>{children}</span>
    </span>
  );
}

function ProcKv({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="text-sm font-semibold mt-0.5 truncate">{value}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Alert chip — surfaces the single most-urgent unresolved alert in the
 * procedure grid. The full strip lived under the header card; we
 * removed it per design and replaced it with this glance affordance.
 * -------------------------------------------------------------------------- */

const SEV_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const SEV_STYLE: Record<
  AlertSeverity,
  { icon: typeof AlertOctagon; ring: string; text: string; bg: string }
> = {
  critical: {
    icon: AlertOctagon,
    ring: "ring-danger/30",
    text: "text-danger",
    bg: "bg-danger/10",
  },
  warning: {
    icon: AlertTriangle,
    ring: "ring-warning/30",
    text: "text-warning",
    bg: "bg-warning/10",
  },
  info: {
    icon: Info,
    ring: "ring-info/30",
    text: "text-info",
    bg: "bg-info/10",
  },
};

function pickTopAlert(alerts: PatientAlert[]): PatientAlert | null {
  const unresolved = alerts.filter((a) => !a.resolved);
  if (unresolved.length === 0) return null;
  return [...unresolved].sort(
    (a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity],
  )[0]!;
}

function AlertChip({ alert }: { alert: PatientAlert }) {
  const style = SEV_STYLE[alert.severity];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ring-1 max-w-full",
        style.bg,
        style.ring,
        style.text,
      )}
      title={alert.detail ?? alert.label}
    >
      <Icon className="size-3 shrink-0" />
      <span className="text-xs font-semibold truncate">{alert.label}</span>
    </span>
  );
}
