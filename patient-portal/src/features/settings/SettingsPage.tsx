import {
  Activity,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  Droplet,
  Globe,
  Heart,
  KeyRound,
  Languages,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Pill,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  Upload,
  User as UserIcon,
  UserCircle2,
  Watch,
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate, cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { STORAGE_KEYS as AUTH_STORAGE_KEYS } from "@/config/constants";
import { authApi } from "@/features/auth/api/auth-api";
import type {
  PatientHealthcarePrefs,
  PatientNotificationPrefs,
  PatientPreferences,
} from "@/types";
import {
  ChangePasswordModal,
  EditProfileModal,
  UploadPhotoModal,
} from "./components/SettingsModals";

const COMING_SOON = (label: string) =>
  toast.info(`${label} — coming soon`);

const NOTIFICATION_DEFAULTS: PatientNotificationPrefs = {
  appointments: true,
  sms: true,
  email: true,
  labs: true,
};

const HEALTHCARE_DEFAULTS: PatientHealthcarePrefs = {
  pharmacy: null,
  language: null,
  comm_channel: null,
};

const PREFERENCES_KEY = ["patient-portal", "preferences"] as const;
const AI_SUMMARY_KEY = ["patient-portal", "ai-summary"] as const;

function usePreferences() {
  const queryClient = useQueryClient();
  const query = useQuery<PatientPreferences>({
    queryKey: PREFERENCES_KEY,
    queryFn: () => authApi.getPreferences(),
  });
  const mutation = useMutation({
    mutationFn: (patch: Partial<PatientPreferences>) =>
      authApi.updatePreferences(patch),
    onSuccess: (data) => {
      queryClient.setQueryData(PREFERENCES_KEY, data);
      toast.success("Preferences updated");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Couldn't save preferences"),
  });
  return { query, mutation };
}

function downloadMedicalSummary() {
  // Use a hidden anchor + Bearer token via fetch so the auth header is
  // attached (anchors can't carry custom headers).
  const url = authApi.medicalSummaryUrl();
  const token = window.localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
  toast.success("Preparing your medical summary…");
  fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then(async (r) => {
      if (!r.ok) throw new Error(`Failed (${r.status})`);
      const blob = await r.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = "medical-summary.txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    })
    .catch((e) =>
      toast.error(e instanceof Error ? e.message : "Couldn't download summary")
    );
}

const NOT_ON_FILE = "Not on file";

export function SettingsPage() {
  const me = useAuthStore((s) => s.me);
  const logout = useAuthStore((s) => s.logout);
  const [editOpen, setEditOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  if (!me) return null;

  const fullName = `${me.first_name} ${me.last_name}`.trim();

  const formatAddress = (parts: (string | null)[]): string => {
    const joined = parts.filter((p) => p && p.trim()).join(", ");
    return joined || NOT_ON_FILE;
  };
  const mailingAddress = formatAddress([
    me.mailing_address_line1,
    me.mailing_address_line2,
    me.mailing_city,
    me.mailing_state,
    me.mailing_postal_code,
    me.mailing_country,
  ]);
  const physicalAddress = me.physical_same_as_mailing
    ? mailingAddress
    : formatAddress([
        me.physical_address_line1,
        me.physical_address_line2,
        me.physical_city,
        me.physical_state,
        me.physical_postal_code,
        me.physical_country,
      ]);
  const emergencyContact = me.emergency_contact_name
    ? `${me.emergency_contact_name}${me.emergency_contact_relationship ? ` (${me.emergency_contact_relationship})` : ""}${me.emergency_contact_phone ? ` · ${me.emergency_contact_phone}` : ""}`
    : NOT_ON_FILE;

  // Profile completion — count fields that are present
  const fields = [
    me.first_name,
    me.last_name,
    me.email,
    me.phone,
    me.dob,
    me.mrn,
    me.blood_group,
    me.mailing_address_line1,
    me.emergency_contact_name,
  ];
  const filled = fields.filter(Boolean).length;
  const completionPct = Math.round((filled / fields.length) * 100);

  const profileRows: Array<{
    icon: React.ReactNode;
    label: string;
    value: string;
    placeholder?: boolean;
  }> = [
    { icon: <UserIcon />, label: "Full name", value: fullName || NOT_ON_FILE, placeholder: !fullName },
    { icon: <Mail />, label: "Email address", value: me.email ?? NOT_ON_FILE, placeholder: !me.email },
    { icon: <Phone />, label: "Phone number", value: me.phone ?? NOT_ON_FILE, placeholder: !me.phone },
    { icon: <Calendar />, label: "Date of birth", value: me.dob ? formatDate(me.dob) : NOT_ON_FILE, placeholder: !me.dob },
    { icon: <UserCircle2 />, label: "MRN", value: me.mrn },
    { icon: <Droplet />, label: "Blood group", value: me.blood_group ?? NOT_ON_FILE, placeholder: !me.blood_group },
    { icon: <UserIcon />, label: "Gender", value: me.gender_identity ?? me.sex ?? NOT_ON_FILE, placeholder: !me.gender_identity && !me.sex },
    { icon: <MapPin />, label: "Mailing address", value: mailingAddress, placeholder: mailingAddress === NOT_ON_FILE },
    { icon: <MapPin />, label: "Physical address", value: physicalAddress, placeholder: physicalAddress === NOT_ON_FILE },
    { icon: <Phone />, label: "Emergency contact", value: emergencyContact, placeholder: emergencyContact === NOT_ON_FILE },
  ];

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Manage your profile and healthcare account."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
        {/* Left column — profile + bottom prefs grid */}
        <div className="lg:col-span-8 space-y-5 lg:space-y-6">
          <ProfileCard
            name={fullName}
            email={me.email}
            mrn={me.mrn}
            avatarUrl={me.avatar_url}
            completionPct={completionPct}
            rows={profileRows}
            onEdit={() => setEditOpen(true)}
            onUploadPhoto={() => setPhotoOpen(true)}
            onDownloadSummary={downloadMedicalSummary}
          />
          {/* Preferences row sits beside the right rail's lower half,
              keeping the page visually balanced (no orphan space). */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
            <NotificationPreferencesCard />
            <HealthcarePreferencesCard />
          </div>
        </div>

        {/* Right rail — stacks to match profile column height */}
        <div className="lg:col-span-4 space-y-5 lg:space-y-6">
          <InsuranceCard />
          <AIInsightsCard />
          <SecurityCard
            onSignOut={() => logout()}
            onChangePassword={() => setPasswordOpen(true)}
          />
          <ConnectedDevicesCard />
        </div>
      </div>

      <EditProfileModal open={editOpen} onOpenChange={setEditOpen} me={me} />
      <UploadPhotoModal
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        currentAvatarUrl={me.avatar_url}
      />
      <ChangePasswordModal
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
      />
    </>
  );
}

/* ────────────────────────────────────────────────────────────
   Profile card
   ──────────────────────────────────────────────────────────── */

function ProfileCard({
  name,
  email,
  mrn,
  avatarUrl,
  completionPct,
  rows,
  onEdit,
  onUploadPhoto,
  onDownloadSummary,
}: {
  name: string;
  email: string | null;
  mrn: string;
  avatarUrl: string | null;
  completionPct: number;
  rows: Array<{ icon: React.ReactNode; label: string; value: string; placeholder?: boolean }>;
  onEdit: () => void;
  onUploadPhoto: () => void;
  onDownloadSummary: () => void;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-0 rounded-[28px] border-slate-200/70 bg-white",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-12px_rgba(15,23,42,0.12)]"
      )}
    >
      {/* Hero band */}
      <div className="relative px-6 lg:px-8 pt-7 pb-6 bg-gradient-to-br from-primary-50 via-white to-white">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(79,140,255,0.12),transparent_55%)]"
        />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <ProfilePortrait name={name || "Patient"} src={avatarUrl} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[22px] font-bold tracking-tight text-slate-900 truncate">
                {name || "Patient"}
              </h2>
              <Badge variant="success" size="sm" dot>
                Verified
              </Badge>
            </div>
            <div className="text-sm text-slate-500 truncate mt-0.5">
              {email ?? "Patient"}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold tracking-wide px-2.5 py-1">
                <UserCircle2 className="size-3" />
                MRN {mrn}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 text-success text-[11px] font-semibold tracking-wide px-2.5 py-1">
                <ShieldCheck className="size-3" />
                Insurance active
              </span>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
            <Button size="sm" variant="secondary" onClick={onEdit}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
          </div>
        </div>

        {/* Profile completion */}
        <div className="relative mt-6 rounded-2xl bg-white/70 backdrop-blur border border-white/80 shadow-sm px-4 py-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-[12px] font-semibold text-slate-700 inline-flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" />
              Profile completion
            </div>
            <div className="text-[12px] font-bold text-slate-900 tabular-nums">
              {completionPct}%
            </div>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-[#7AB2FF] rounded-full transition-all"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 px-6 lg:px-8 pt-5 pb-1">
        <Button size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" />
          Edit profile
        </Button>
        <Button size="sm" variant="secondary" onClick={onUploadPhoto}>
          <Upload className="size-3.5" />
          Upload photo
        </Button>
        <Button size="sm" variant="secondary" onClick={onDownloadSummary}>
          <Download className="size-3.5" />
          Medical summary
        </Button>
      </div>

      {/* Profile details */}
      <div className="px-6 lg:px-8 pt-6 pb-7">
        <div className="text-[11px] uppercase tracking-[0.08em] text-slate-400 font-semibold mb-3">
          Profile details
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          {rows.map((r, idx) => (
            <div
              key={r.label}
              className={cn(
                "flex items-center gap-3 py-3 border-b border-slate-100",
                idx >= rows.length - 2 && "sm:border-b-0"
              )}
            >
              <div className="size-9 rounded-xl bg-primary/8 text-primary grid place-items-center [&_svg]:size-4 shrink-0">
                {r.icon}
              </div>
              <div className="min-w-0 flex-1">
                <dt className="text-[10.5px] uppercase tracking-[0.06em] text-slate-400 font-semibold">
                  {r.label}
                </dt>
                <dd
                  className={cn(
                    "text-[13.5px] truncate mt-0.5",
                    r.placeholder
                      ? "text-slate-400 italic font-normal"
                      : "text-slate-900 font-semibold"
                  )}
                >
                  {r.value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-slate-400">
          Need a change? Contact your provider's office to update your record.
        </p>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────
   Profile portrait — vertical rectangle (3:4)
   ──────────────────────────────────────────────────────────── */

function ProfilePortrait({ name, src }: { name: string; src: string | null }) {
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "w-[88px] h-[112px] rounded-2xl overflow-hidden",
          "ring-4 ring-white shadow-[0_8px_24px_rgba(79,140,255,0.35)]"
        )}
      >
        {src ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-primary-gradient grid place-items-center text-white font-bold text-2xl tracking-wide">
            {initials(name)}
          </div>
        )}
      </div>
      <span
        aria-label="Online"
        className="absolute -bottom-1 -right-1 size-4 rounded-full bg-success ring-2 ring-white"
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Insurance card
   ──────────────────────────────────────────────────────────── */

function InsuranceCard() {
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-0 rounded-3xl border-slate-200/70",
        "bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#1D4ED8] text-white",
        "shadow-[0_10px_30px_-12px_rgba(29,78,216,0.45)]"
      )}
    >
      <div
        aria-hidden
        className="absolute -top-12 -right-10 size-40 rounded-full bg-white/10 blur-2xl"
      />
      <div className="relative p-5">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <div className="size-9 rounded-xl bg-white/15 backdrop-blur grid place-items-center">
              <Shield className="size-4 text-white" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-white/70 font-semibold">
                Insurance
              </div>
              <div className="text-sm font-semibold">Blue Shield PPO</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-success/20 text-success px-2 py-0.5 text-[10px] font-semibold">
            <span className="size-1.5 rounded-full bg-success" />
            Active
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-3">
          <Field label="Member ID" value="HC ••• 5230" />
          <Field label="Group" value="42-887" />
          <Field label="Copay" value="$20" />
          <Field label="Coverage" value="In network" />
        </div>

        <div className="mt-5 flex items-center justify-between text-[11px] text-white/70">
          <span>Renews · Jan 2027</span>
          <button
            type="button"
            onClick={() => COMING_SOON("Insurance card view")}
            className="inline-flex items-center gap-1 text-white font-medium hover:underline"
          >
            View card <ChevronRight className="size-3" />
          </button>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-white/60 font-semibold">
        {label}
      </div>
      <div className="text-[13px] font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   AI insights card
   ──────────────────────────────────────────────────────────── */

function AIInsightsCard() {
  const [expanded, setExpanded] = useState(false);
  const summaryQuery = useQuery({
    queryKey: AI_SUMMARY_KEY,
    queryFn: () => authApi.getAISummary(),
    staleTime: 5 * 60 * 1000,
  });
  const summary = summaryQuery.data;

  return (
    <Card
      className={cn(
        "relative overflow-hidden p-0 rounded-3xl border-slate-200/70 bg-white",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-14px_rgba(15,23,42,0.10)]"
      )}
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-2">
            <div className="size-9 rounded-xl bg-primary-gradient grid place-items-center shadow-glow">
              <Sparkles className="size-4 text-white" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-primary font-bold">
                AI Insight
              </div>
              <div className="text-sm font-semibold text-slate-900">
                Health summary
              </div>
            </div>
          </div>
          {summary && (
            <span className="text-[10px] font-bold tabular-nums text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {summary.confidence}%
            </span>
          )}
        </div>

        {summaryQuery.isLoading ? (
          <p className="text-[13px] text-slate-400">Generating summary…</p>
        ) : summaryQuery.isError ? (
          <p className="text-[13px] text-danger">
            Couldn't load summary.{" "}
            <button
              type="button"
              onClick={() => summaryQuery.refetch()}
              className="underline"
            >
              Retry
            </button>
          </p>
        ) : (
          <>
            <p className="text-[13px] text-slate-600 leading-relaxed">
              {summary?.summary}
            </p>
            {expanded && summary?.bullets && summary.bullets.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {summary.bullets.map((b, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[12.5px] text-slate-600"
                  >
                    <Sparkles className="size-3 text-primary mt-0.5 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
            >
              {expanded ? "Hide details" : "View full report"}{" "}
              <ChevronRight
                className={cn(
                  "size-3.5 transition-transform",
                  expanded && "rotate-90"
                )}
              />
            </button>
          </>
        )}
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────
   Security card
   ──────────────────────────────────────────────────────────── */

function SecurityCard({
  onSignOut,
  onChangePassword,
}: {
  onSignOut: () => void;
  onChangePassword: () => void;
}) {
  return (
    <SideCard
      title="Session & security"
      icon={<Shield className="size-4" />}
    >
      <SettingsRow
        icon={<KeyRound className="size-4" />}
        title="Change password"
        hint="Use a strong, unique password"
        actionLabel="Update"
        onAction={onChangePassword}
      />
      <SettingsRow
        icon={<Smartphone className="size-4" />}
        title="Two-factor authentication"
        hint="Recommended for your security"
        badge={<Badge variant="warning" size="sm">Off</Badge>}
        actionLabel="Enable"
        onAction={() => COMING_SOON("Two-factor authentication")}
      />
      <SettingsRow
        icon={<Activity className="size-4" />}
        title="Active sessions"
        hint="Manage devices signed into your account"
        actionLabel="Manage"
        onAction={() => COMING_SOON("Active sessions")}
        noBorder
      />
      <div className="pt-3 mt-1 border-t border-slate-100">
        <Button variant="destructive" size="sm" onClick={onSignOut} className="w-full">
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </SideCard>
  );
}

/* ────────────────────────────────────────────────────────────
   Notification preferences card
   ──────────────────────────────────────────────────────────── */

function NotificationPreferencesCard() {
  const { query, mutation } = usePreferences();
  const prefs = query.data?.notifications ?? NOTIFICATION_DEFAULTS;

  const update = (key: keyof PatientNotificationPrefs) => (next: boolean) => {
    const merged = { ...prefs, [key]: next };
    mutation.mutate({ notifications: merged });
  };

  return (
    <SideCard
      title="Notifications"
      icon={<Bell className="size-4" />}
    >
      <ToggleRow
        icon={<Calendar className="size-4" />}
        title="Appointment reminders"
        hint="24h and 1h before visit"
        value={prefs.appointments}
        onChange={update("appointments")}
      />
      <ToggleRow
        icon={<MessageSquare className="size-4" />}
        title="SMS alerts"
        hint="Text updates for visits & messages"
        value={prefs.sms}
        onChange={update("sms")}
      />
      <ToggleRow
        icon={<Mail className="size-4" />}
        title="Email notifications"
        hint="Weekly summary & receipts"
        value={prefs.email}
        onChange={update("email")}
      />
      <ToggleRow
        icon={<Heart className="size-4" />}
        title="Lab result alerts"
        hint="Notify when new results arrive"
        value={prefs.labs}
        onChange={update("labs")}
        noBorder
      />
    </SideCard>
  );
}

/* ────────────────────────────────────────────────────────────
   Healthcare preferences card
   ──────────────────────────────────────────────────────────── */

const LANGUAGE_CHOICES = [
  "English (US)",
  "Spanish",
  "French",
  "Hindi",
  "Mandarin",
  "Other",
];
const COMM_CHANNEL_CHOICES = ["Email", "SMS", "Phone", "Email + SMS"];

function HealthcarePreferencesCard() {
  const { query, mutation } = usePreferences();
  const prefs = query.data?.healthcare ?? HEALTHCARE_DEFAULTS;

  const save = (next: Partial<PatientHealthcarePrefs>) => {
    mutation.mutate({
      healthcare: { ...prefs, ...next } as PatientHealthcarePrefs,
    });
  };

  const changePharmacy = () => {
    const next = window.prompt("Preferred pharmacy", prefs.pharmacy ?? "");
    if (next === null) return;
    const trimmed = next.trim();
    save({ pharmacy: trimmed || null });
  };

  const cycle = (
    current: string | null,
    choices: string[],
    field: keyof PatientHealthcarePrefs
  ) => {
    const idx = current ? choices.indexOf(current) : -1;
    const nextVal = choices[(idx + 1) % choices.length];
    save({ [field]: nextVal });
  };

  return (
    <SideCard
      title="Healthcare preferences"
      icon={<Stethoscope className="size-4" />}
    >
      <SettingsRow
        icon={<Pill className="size-4" />}
        title="Preferred pharmacy"
        hint={prefs.pharmacy ?? "Not set"}
        actionLabel="Change"
        onAction={changePharmacy}
      />
      <SettingsRow
        icon={<Languages className="size-4" />}
        title="Preferred language"
        hint={prefs.language ?? "Not set"}
        actionLabel="Edit"
        onAction={() => cycle(prefs.language, LANGUAGE_CHOICES, "language")}
      />
      <SettingsRow
        icon={<Globe className="size-4" />}
        title="Communication channel"
        hint={prefs.comm_channel ?? "Not set"}
        actionLabel="Edit"
        onAction={() =>
          cycle(prefs.comm_channel, COMM_CHANNEL_CHOICES, "comm_channel")
        }
      />
      <SettingsRow
        icon={<UserIcon className="size-4" />}
        title="Accessibility"
        hint="Standard contrast · Default font"
        actionLabel="Edit"
        onAction={() => COMING_SOON("Accessibility settings")}
        noBorder
      />
    </SideCard>
  );
}

/* ────────────────────────────────────────────────────────────
   Connected devices
   ──────────────────────────────────────────────────────────── */

function ConnectedDevicesCard() {
  return (
    <SideCard
      title="Connected devices"
      icon={<Watch className="size-4" />}
    >
      <div className="flex items-center gap-3 py-2.5">
        <div className="size-9 rounded-xl bg-slate-100 grid place-items-center shrink-0">
          <Watch className="size-4 text-slate-700" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-slate-900">Apple Watch</div>
          <div className="text-[11px] text-slate-500 inline-flex items-center gap-1">
            <CheckCircle2 className="size-3 text-success" />
            Syncing · 12 min ago
          </div>
        </div>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => COMING_SOON("Device management")}
        >
          Manage
        </Button>
      </div>
      <button
        type="button"
        onClick={() => COMING_SOON("Device pairing")}
        className="w-full mt-2 rounded-xl border border-dashed border-slate-200 text-[12px] font-medium text-slate-500 hover:text-slate-700 hover:border-slate-300 py-2.5 transition"
      >
        + Connect a device
      </button>
    </SideCard>
  );
}

/* ────────────────────────────────────────────────────────────
   Shared side card primitives
   ──────────────────────────────────────────────────────────── */

function SideCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "p-5 rounded-3xl border-slate-200/70 bg-white",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-14px_rgba(15,23,42,0.10)]"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="size-8 rounded-xl bg-primary/8 text-primary grid place-items-center [&_svg]:size-4">
          {icon}
        </div>
        <h3 className="text-[14px] font-semibold tracking-tight text-slate-900">
          {title}
        </h3>
      </div>
      <div className="space-y-0.5">{children}</div>
    </Card>
  );
}

function SettingsRow({
  icon,
  title,
  hint,
  badge,
  actionLabel,
  onAction,
  noBorder,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  badge?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  noBorder?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2.5",
        !noBorder && "border-b border-slate-100"
      )}
    >
      <div className="size-9 rounded-xl bg-slate-50 text-slate-600 grid place-items-center [&_svg]:size-4 shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-slate-900 truncate">
            {title}
          </span>
          {badge}
        </div>
        {hint && <div className="text-[11.5px] text-slate-500 truncate">{hint}</div>}
      </div>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="text-[12px] font-semibold text-primary hover:underline shrink-0"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  hint,
  value,
  onChange,
  noBorder,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  noBorder?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2.5",
        !noBorder && "border-b border-slate-100"
      )}
    >
      <div className="size-9 rounded-xl bg-slate-50 text-slate-600 grid place-items-center [&_svg]:size-4 shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-slate-900 truncate">
          {title}
        </div>
        {hint && <div className="text-[11.5px] text-slate-500 truncate">{hint}</div>}
      </div>
      <Toggle on={value} onClick={() => onChange(!value)} />
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-5 w-9 rounded-full transition-colors shrink-0 ring-focus",
        on ? "bg-primary" : "bg-slate-200"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-all",
          on ? "left-[18px]" : "left-0.5"
        )}
      />
    </button>
  );
}
