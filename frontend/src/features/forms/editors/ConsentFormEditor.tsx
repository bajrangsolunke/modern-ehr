/**
 * Patient consent form editor — section-based, sidebar progress.
 * Mirrors the backend ConsentFormPayload exactly.
 *
 * Sections:
 *   1. Patient consent form (release auth + signature)
 *   2. Financial responsibility / assignment of benefits (read + ack)
 *   3. Acknowledgement of receipt of Notice of Privacy Rules
 *      (contact preferences + signature)
 */
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { FormShell, type FormSection } from "./shared/FormShell";
import {
  SignatureBlock,
  emptySignature,
  type SignatureValue,
} from "./shared/SignatureBlock";
import { useSubmitForm } from "../hooks/use-forms";
import type { FormRequest } from "../api/forms-api";

/* -------------------------------------------------------------------------- */
/* Static legal text — pulled out so the editor stays focused on data         */
/* -------------------------------------------------------------------------- */

const PATIENT_CONSENT_PARAGRAPHS = [
  "I authorize the practice to release any medical or other information that may be necessary to process medical claims on my behalf to related physicians, rehabilitation counselors, social workers, insurance carriers, or attorneys.",
  "I authorize the practice to initiate a complaint to the insurance commissioner for any reason on my behalf.",
  "I, the undersigned, state that I have read and agree to the terms and conditions set forth.",
];

const FINANCIAL_PARAGRAPHS = [
  "I understand that I am responsible for paying my co-payments and deductibles at the time of service. I also understand that I am responsible for any balance due after payment by my insurance company.",
  "I, the undersigned, understand that the practice will bill my insurance company for services rendered upon verification of coverage by my insurance company. If my insurance company fails to render payment for services rendered, I hereby personally guarantee payment for my medical care and services rendered. If your insurance company does not remit payment within 60 days, the balance will be due in full.",
  "I hereby request that my insurance carrier make payment directly to the practice for all services rendered by this facility. If my current policy prohibits direct payment to the practice, I hereby instruct and direct my insurance company to make the check out in my name but send the check to the listed address of the practice.",
  "If my insurance carrier makes a payment to me, I agree to immediately pay over these funds to the practice. I also authorize the practice to deposit checks received on my account when made out to me.",
  "I understand and agree that if I fail to make any of the payments for which I am responsible in a timely manner, I will be responsible for all the costs of collecting monies owed, including court costs, collection agency fees and attorney fees.",
  "I, the undersigned, acknowledge that by signing this form I am authorizing the practice to submit charges via mail or internet to my insurance carrier. This is a \"signature on file\" authorization.",
];

const PRIVACY_PARAGRAPHS = [
  "I certify that I was offered a copy of the practice's Notice of Privacy Practices. The Notice of Privacy Practices describes the types and uses and disclosures of my PHI that might occur in my treatment, payment of my bills or in the performance of the practice's health care operations. The notice of Privacy Practices also describes my rights and the practice's duties with respect to my PHI. The Notice of Privacy Practices is also posted in the reception area.",
  "The practice reserves the right to change the privacy practices that are described in the Notice of Privacy Practices. I may obtain a revised Notice of Privacy Practices by calling the office and requesting a revised copy by sent in the mail or asking for one at the time of my next appointments.",
];

/* -------------------------------------------------------------------------- */
/* Default value                                                              */
/* -------------------------------------------------------------------------- */

function emptyValue() {
  return {
    patient_consent: emptySignature(),
    financial_acknowledged: false,
    privacy_acknowledgement: {
      contact_preferences: {
        home_phone: "",
        home_phone_ok_detailed: false,
        work_phone: "",
        work_phone_callback_only: false,
        mobile_phone: "",
        mobile_do_not_contact: false,
        email: "",
        email_ok: false,
      },
      only_disclose_to_me: false,
      signature_block: emptySignature(),
    },
  };
}

type ConsentValue = ReturnType<typeof emptyValue>;

/* -------------------------------------------------------------------------- */

interface Props {
  form: FormRequest;
  onClose: () => void;
}

export function ConsentFormEditor({ form, onClose }: Props) {
  const submit = useSubmitForm();

  const [value, setValue] = useState<ConsentValue>(() => {
    const base = emptyValue();
    const existing = (form.data ?? {}) as Partial<ConsentValue>;
    return {
      ...base,
      ...existing,
      patient_consent: {
        ...base.patient_consent,
        ...(existing.patient_consent ?? {}),
      },
      privacy_acknowledgement: {
        ...base.privacy_acknowledgement,
        ...(existing.privacy_acknowledgement ?? {}),
        contact_preferences: {
          ...base.privacy_acknowledgement.contact_preferences,
          ...((existing.privacy_acknowledgement as ConsentValue["privacy_acknowledgement"] | undefined)
            ?.contact_preferences ?? {}),
        },
        signature_block: {
          ...base.privacy_acknowledgement.signature_block,
          ...((existing.privacy_acknowledgement as ConsentValue["privacy_acknowledgement"] | undefined)
            ?.signature_block ?? {}),
        },
      },
    };
  });

  const sections = useMemo<FormSection[]>(
    () => [
      {
        id: "consent",
        label: "Patient consent",
        complete: isSignatureFilled(value.patient_consent),
        render: () => (
          <ConsentBlock
            paragraphs={PATIENT_CONSENT_PARAGRAPHS}
            title="Patient consent form"
            signature={value.patient_consent}
            onSignatureChange={(s) =>
              setValue((cur) => ({ ...cur, patient_consent: s }))
            }
          />
        ),
      },
      {
        id: "financial",
        label: "Financial responsibility",
        complete: value.financial_acknowledged,
        render: () => (
          <FinancialBlock
            acknowledged={value.financial_acknowledged}
            onChange={(b) =>
              setValue((cur) => ({ ...cur, financial_acknowledged: b }))
            }
          />
        ),
      },
      {
        id: "privacy",
        label: "Privacy rules acknowledgement",
        complete: isSignatureFilled(
          value.privacy_acknowledgement.signature_block
        ),
        render: () => (
          <PrivacyBlock
            value={value.privacy_acknowledgement}
            onChange={(v) =>
              setValue((cur) => ({ ...cur, privacy_acknowledgement: v }))
            }
          />
        ),
      },
    ],
    [value]
  );

  const canSave =
    isSignatureFilled(value.patient_consent) &&
    isSignatureFilled(value.privacy_acknowledgement.signature_block) &&
    value.financial_acknowledged;

  const handleSave = async () => {
    await submit.mutateAsync({ id: form.id, data: value });
    onClose();
  };

  return (
    <FormShell
      title="Consent form"
      sections={sections}
      onBack={onClose}
      onCancel={onClose}
      onSave={handleSave}
      saving={submit.isPending}
      canSave={canSave}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Section bodies                                                             */
/* -------------------------------------------------------------------------- */

function ConsentBlock({
  paragraphs,
  title,
  signature,
  onSignatureChange,
}: {
  paragraphs: string[];
  title: string;
  signature: SignatureValue;
  onSignatureChange: (s: SignatureValue) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-bold mb-2">{title}</h4>
        <div className="space-y-2">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-foreground/80">
              {p}
            </p>
          ))}
        </div>
      </div>
      <div className="pt-3 border-t border-border">
        <SignatureBlock
          value={signature}
          onChange={onSignatureChange}
          required
        />
      </div>
    </div>
  );
}

function FinancialBlock({
  acknowledged,
  onChange,
}: {
  acknowledged: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold">
        Financial responsibility / Assignment of benefits
      </h4>
      <div className="space-y-2">
        {FINANCIAL_PARAGRAPHS.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-foreground/80">
            {p}
          </p>
        ))}
      </div>
      <label className="flex items-start gap-2 cursor-pointer pt-3 border-t border-border">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 rounded border-border mt-0.5"
        />
        <span className="text-sm font-medium">
          I have read and acknowledge the financial responsibility terms above.{" "}
          <span className="text-danger">*</span>
        </span>
      </label>
    </div>
  );
}

function PrivacyBlock({
  value,
  onChange,
}: {
  value: ConsentValue["privacy_acknowledgement"];
  onChange: (v: ConsentValue["privacy_acknowledgement"]) => void;
}) {
  const setPref = <
    K extends keyof ConsentValue["privacy_acknowledgement"]["contact_preferences"],
  >(
    k: K,
    v: ConsentValue["privacy_acknowledgement"]["contact_preferences"][K]
  ) =>
    onChange({
      ...value,
      contact_preferences: { ...value.contact_preferences, [k]: v },
    });

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold">
        Acknowledgement of receipt of Notice of Privacy Rules
      </h4>
      <div className="space-y-2">
        {PRIVACY_PARAGRAPHS.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-foreground/80">
            {p}
          </p>
        ))}
      </div>

      <div className="space-y-3 pt-3 border-t border-border">
        <ContactRow
          label="Home telephone"
          value={value.contact_preferences.home_phone}
          onChange={(v) => setPref("home_phone", v)}
          checkLabel="OK to leave message with detailed information."
          checked={value.contact_preferences.home_phone_ok_detailed}
          onCheckChange={(b) => setPref("home_phone_ok_detailed", b)}
        />
        <ContactRow
          label="Work telephone"
          value={value.contact_preferences.work_phone}
          onChange={(v) => setPref("work_phone", v)}
          checkLabel="Leave a message with call-back number only."
          checked={value.contact_preferences.work_phone_callback_only}
          onCheckChange={(b) => setPref("work_phone_callback_only", b)}
        />
        <ContactRow
          label="Mobile telephone"
          value={value.contact_preferences.mobile_phone}
          onChange={(v) => setPref("mobile_phone", v)}
          checkLabel="Do not contact me on my mobile phone."
          checked={value.contact_preferences.mobile_do_not_contact}
          onCheckChange={(b) => setPref("mobile_do_not_contact", b)}
        />
        <ContactRow
          label="Email"
          value={value.contact_preferences.email}
          onChange={(v) => setPref("email", v)}
          checkLabel="OK to communicate using email."
          checked={value.contact_preferences.email_ok}
          onCheckChange={(b) => setPref("email_ok", b)}
        />

        <label className="flex items-start gap-2 cursor-pointer pt-2">
          <input
            type="checkbox"
            checked={value.only_disclose_to_me}
            onChange={(e) =>
              onChange({ ...value, only_disclose_to_me: e.target.checked })
            }
            className="size-4 rounded border-border mt-0.5"
          />
          <span className="text-sm">Only disclose information to me.</span>
        </label>
      </div>

      <div className="pt-3 border-t border-border">
        <SignatureBlock
          value={value.signature_block}
          onChange={(s) => onChange({ ...value, signature_block: s })}
          required
        />
      </div>
    </div>
  );
}

function ContactRow({
  label,
  value,
  onChange,
  checkLabel,
  checked,
  onCheckChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  checkLabel: string;
  checked: boolean;
  onCheckChange: (v: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[160px_240px_1fr] items-center gap-2 sm:gap-4">
      <div className="flex items-baseline gap-1.5 text-sm font-medium">
        <span className="size-1.5 rounded-full bg-foreground inline-block" />
        {label}
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckChange(e.target.checked)}
          className="size-4 rounded border-border"
        />
        <span className="text-sm">{checkLabel}</span>
      </label>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function isSignatureFilled(s: SignatureValue): boolean {
  return Boolean(s.signature.trim() && s.name.trim() && s.date);
}
