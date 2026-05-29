import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { authApi } from "@/features/auth/api/auth-api";
import { useAuthStore } from "@/stores/auth-store";
import type { PatientMe } from "@/types";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp";

/* ────────────────────────────────────────────────────────────
   Shared modal shell
   ──────────────────────────────────────────────────────────── */

function ModalShell({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm animate-dialog-in" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[92vw] max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-elev",
            "p-6 animate-dialog-in"
          )}
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <Dialog.Title className="text-[18px] font-semibold tracking-tight text-slate-900">
                {title}
              </Dialog.Title>
              {subtitle && (
                <Dialog.Description className="text-[13px] text-slate-500 mt-0.5">
                  {subtitle}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="size-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 grid place-items-center"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ────────────────────────────────────────────────────────────
   Edit Profile
   ──────────────────────────────────────────────────────────── */

type EditProfileState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  dob: string;
  blood_group: string;
  gender_identity: string;
  preferred_pronouns: string;
  // mailing
  m_line1: string;
  m_line2: string;
  m_city: string;
  m_state: string;
  m_postal: string;
  m_country: string;
  // physical
  p_same: boolean;
  p_line1: string;
  p_line2: string;
  p_city: string;
  p_state: string;
  p_postal: string;
  p_country: string;
  // emergency
  ec_name: string;
  ec_phone: string;
  ec_rel: string;
};

function stateFromMe(me: PatientMe): EditProfileState {
  return {
    first_name: me.first_name,
    last_name: me.last_name,
    email: me.email ?? "",
    phone: me.phone ?? "",
    dob: me.dob ?? "",
    blood_group: me.blood_group ?? "",
    gender_identity: me.gender_identity ?? "",
    preferred_pronouns: me.preferred_pronouns ?? "",
    m_line1: me.mailing_address_line1 ?? "",
    m_line2: me.mailing_address_line2 ?? "",
    m_city: me.mailing_city ?? "",
    m_state: me.mailing_state ?? "",
    m_postal: me.mailing_postal_code ?? "",
    m_country: me.mailing_country ?? "",
    p_same: me.physical_same_as_mailing,
    p_line1: me.physical_address_line1 ?? "",
    p_line2: me.physical_address_line2 ?? "",
    p_city: me.physical_city ?? "",
    p_state: me.physical_state ?? "",
    p_postal: me.physical_postal_code ?? "",
    p_country: me.physical_country ?? "",
    ec_name: me.emergency_contact_name ?? "",
    ec_phone: me.emergency_contact_phone ?? "",
    ec_rel: me.emergency_contact_relationship ?? "",
  };
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function EditProfileModal({
  open,
  onOpenChange,
  me,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  me: PatientMe;
}) {
  const setMe = useAuthStore((s) => s.setMe);
  const [s, setS] = useState<EditProfileState>(() => stateFromMe(me));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setS(stateFromMe(me));
      setError(null);
    }
  }, [open, me]);

  const set = <K extends keyof EditProfileState>(
    key: K,
    value: EditProfileState[K]
  ) => setS((cur) => ({ ...cur, [key]: value }));

  const blank = (v: string) => (v.trim() ? v.trim() : null);

  const save = async () => {
    if (!s.first_name.trim() || !s.last_name.trim()) {
      setError("First and last name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await authApi.updateMe({
        first_name: s.first_name.trim(),
        last_name: s.last_name.trim(),
        email: blank(s.email),
        phone: blank(s.phone),
        dob: s.dob || null,
        blood_group: blank(s.blood_group),
        gender_identity: blank(s.gender_identity),
        preferred_pronouns: blank(s.preferred_pronouns),
        mailing_address_line1: blank(s.m_line1),
        mailing_address_line2: blank(s.m_line2),
        mailing_city: blank(s.m_city),
        mailing_state: blank(s.m_state),
        mailing_postal_code: blank(s.m_postal),
        mailing_country: blank(s.m_country),
        physical_same_as_mailing: s.p_same,
        physical_address_line1: s.p_same ? null : blank(s.p_line1),
        physical_address_line2: s.p_same ? null : blank(s.p_line2),
        physical_city: s.p_same ? null : blank(s.p_city),
        physical_state: s.p_same ? null : blank(s.p_state),
        physical_postal_code: s.p_same ? null : blank(s.p_postal),
        physical_country: s.p_same ? null : blank(s.p_country),
        emergency_contact_name: blank(s.ec_name),
        emergency_contact_phone: blank(s.ec_phone),
        emergency_contact_relationship: blank(s.ec_rel),
      });
      setMe(updated);
      toast.success("Profile updated");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Edit profile"
      subtitle="Update your contact details, addresses, and emergency contact."
    >
      <Section title="Personal">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="First name" htmlFor="first" required>
            <Input
              id="first"
              value={s.first_name}
              onChange={(e) => set("first_name", e.target.value)}
            />
          </FormField>
          <FormField label="Last name" htmlFor="last" required>
            <Input
              id="last"
              value={s.last_name}
              onChange={(e) => set("last_name", e.target.value)}
            />
          </FormField>
        </div>
        <FormField label="Date of birth" htmlFor="dob" className="mt-3">
          <Input
            id="dob"
            type="date"
            value={s.dob}
            onChange={(e) => set("dob", e.target.value)}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <FormField label="Blood group" htmlFor="blood">
            <Select
              id="blood"
              value={s.blood_group}
              onChange={(v) => set("blood_group", v)}
              choices={["", ...BLOOD_GROUPS]}
              placeholder="Select"
            />
          </FormField>
          <FormField label="Gender identity" htmlFor="gid">
            <Input
              id="gid"
              value={s.gender_identity}
              onChange={(e) => set("gender_identity", e.target.value)}
              placeholder="e.g. Female"
            />
          </FormField>
        </div>
        <FormField label="Preferred pronouns" htmlFor="pron" className="mt-3">
          <Input
            id="pron"
            value={s.preferred_pronouns}
            onChange={(e) => set("preferred_pronouns", e.target.value)}
            placeholder="e.g. she/her"
          />
        </FormField>
      </Section>

      <Section title="Contact">
        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={s.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </FormField>
        <FormField label="Phone" htmlFor="phone" className="mt-3">
          <Input
            id="phone"
            value={s.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </FormField>
      </Section>

      <Section title="Mailing address">
        <AddressFields
          prefix="m"
          values={{
            line1: s.m_line1,
            line2: s.m_line2,
            city: s.m_city,
            state: s.m_state,
            postal: s.m_postal,
            country: s.m_country,
          }}
          onChange={(k, v) =>
            set(
              ({
                line1: "m_line1",
                line2: "m_line2",
                city: "m_city",
                state: "m_state",
                postal: "m_postal",
                country: "m_country",
              } as const)[k],
              v
            )
          }
        />
      </Section>

      <Section title="Physical address">
        <label className="flex items-center gap-2 mb-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={s.p_same}
            onChange={(e) => set("p_same", e.target.checked)}
            className="size-4 rounded border-slate-300"
          />
          Same as mailing address
        </label>
        {!s.p_same && (
          <AddressFields
            prefix="p"
            values={{
              line1: s.p_line1,
              line2: s.p_line2,
              city: s.p_city,
              state: s.p_state,
              postal: s.p_postal,
              country: s.p_country,
            }}
            onChange={(k, v) =>
              set(
                ({
                  line1: "p_line1",
                  line2: "p_line2",
                  city: "p_city",
                  state: "p_state",
                  postal: "p_postal",
                  country: "p_country",
                } as const)[k],
                v
              )
            }
          />
        )}
      </Section>

      <Section title="Emergency contact">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Name" htmlFor="ec_name">
            <Input
              id="ec_name"
              value={s.ec_name}
              onChange={(e) => set("ec_name", e.target.value)}
            />
          </FormField>
          <FormField label="Relationship" htmlFor="ec_rel">
            <Input
              id="ec_rel"
              value={s.ec_rel}
              onChange={(e) => set("ec_rel", e.target.value)}
              placeholder="e.g. Spouse"
            />
          </FormField>
        </div>
        <FormField label="Phone" htmlFor="ec_phone" className="mt-3">
          <Input
            id="ec_phone"
            value={s.ec_phone}
            onChange={(e) => set("ec_phone", e.target.value)}
          />
        </FormField>
      </Section>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          Save changes
        </Button>
      </div>
    </ModalShell>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 first:mt-0">
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-slate-400 font-semibold mb-2">
        {title}
      </div>
      {children}
    </section>
  );
}

type AddressKey = "line1" | "line2" | "city" | "state" | "postal" | "country";

function AddressFields({
  prefix,
  values,
  onChange,
}: {
  prefix: "m" | "p";
  values: Record<AddressKey, string>;
  onChange: (key: AddressKey, value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <FormField label="Address line 1" htmlFor={`${prefix}_line1`}>
        <Input
          id={`${prefix}_line1`}
          value={values.line1}
          onChange={(e) => onChange("line1", e.target.value)}
        />
      </FormField>
      <FormField label="Address line 2" htmlFor={`${prefix}_line2`}>
        <Input
          id={`${prefix}_line2`}
          value={values.line2}
          onChange={(e) => onChange("line2", e.target.value)}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="City" htmlFor={`${prefix}_city`}>
          <Input
            id={`${prefix}_city`}
            value={values.city}
            onChange={(e) => onChange("city", e.target.value)}
          />
        </FormField>
        <FormField label="State / Region" htmlFor={`${prefix}_state`}>
          <Input
            id={`${prefix}_state`}
            value={values.state}
            onChange={(e) => onChange("state", e.target.value)}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Postal code" htmlFor={`${prefix}_postal`}>
          <Input
            id={`${prefix}_postal`}
            value={values.postal}
            onChange={(e) => onChange("postal", e.target.value)}
          />
        </FormField>
        <FormField label="Country" htmlFor={`${prefix}_country`}>
          <Input
            id={`${prefix}_country`}
            value={values.country}
            onChange={(e) => onChange("country", e.target.value)}
          />
        </FormField>
      </div>
    </div>
  );
}

function Select({
  id,
  value,
  onChange,
  choices,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  choices: string[];
  placeholder?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "flex h-10 w-full rounded-full border border-input bg-white px-4 py-2 text-sm",
        "ring-focus disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      {choices.map((c, i) => (
        <option key={i} value={c}>
          {c === "" ? placeholder ?? "Select" : c}
        </option>
      ))}
    </select>
  );
}

/* ────────────────────────────────────────────────────────────
   Upload Photo
   ──────────────────────────────────────────────────────────── */

export function UploadPhotoModal({
  open,
  onOpenChange,
  currentAvatarUrl,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentAvatarUrl: string | null;
}) {
  const setMe = useAuthStore((s) => s.setMe);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPreview(currentAvatarUrl);
      setError(null);
    }
  }, [open, currentAvatarUrl]);

  const pick = (f: File | null) => {
    if (!f) return;
    if (!AVATAR_ACCEPT.split(",").includes(f.type)) {
      setError("Use a PNG, JPEG, or WebP image.");
      return;
    }
    if (f.size > AVATAR_MAX_BYTES) {
      setError(
        `Image is too large (max ${Math.round(AVATAR_MAX_BYTES / (1024 * 1024))} MB).`
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      setError(null);
    };
    reader.readAsDataURL(f);
  };

  const save = async (next: string | null) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await authApi.updateAvatar(next);
      setMe(updated);
      toast.success(next ? "Photo updated" : "Photo removed");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save photo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Update profile photo"
      subtitle="PNG, JPEG, or WebP · up to 2 MB"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className={cn(
            "w-[120px] h-[150px] rounded-2xl overflow-hidden",
            "ring-4 ring-white shadow-[0_8px_24px_rgba(79,140,255,0.25)]",
            "border border-slate-200 bg-slate-50 grid place-items-center"
          )}
        >
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <UploadCloud className="size-8 text-slate-300" />
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={AVATAR_ACCEPT}
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            disabled={saving}
          >
            <UploadCloud className="size-3.5" />
            Choose image
          </Button>
          {currentAvatarUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="text-danger hover:bg-danger/10"
              onClick={() => save(null)}
              disabled={saving}
            >
              Remove
            </Button>
          )}
        </div>

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => save(preview)}
          disabled={saving || !preview || preview === currentAvatarUrl}
        >
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          Save photo
        </Button>
      </div>
    </ModalShell>
  );
}

/* ────────────────────────────────────────────────────────────
   Change Password
   ──────────────────────────────────────────────────────────── */

export function ChangePasswordModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setError(null);
    }
  }, [open]);

  const save = async () => {
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (next === current) {
      setError("New password must be different from the current one.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await authApi.changePassword(current, next);
      toast.success("Password updated");
      onOpenChange(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't change password"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Change password"
      subtitle="Use at least 8 characters with a mix of letters and numbers."
    >
      <FormField label="Current password" htmlFor="current" required>
        <Input
          id="current"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
      </FormField>
      <FormField
        label="New password"
        htmlFor="new"
        required
        className="mt-3"
      >
        <Input
          id="new"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
        />
      </FormField>
      <FormField
        label="Confirm new password"
        htmlFor="confirm"
        required
        className="mt-3"
      >
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </FormField>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={save}
          disabled={saving || !current || !next || !confirm}
        >
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          Update password
        </Button>
      </div>
    </ModalShell>
  );
}
