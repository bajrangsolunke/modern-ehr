/**
 * Branded, print-only layout for a submitted form.
 *
 * Rendered into a body-level portal with class `.print-root .print-only`
 * — on screen it's `display: none`; during `window.print()` the global
 * print styles hide everything else and let this layout flow naturally
 * across as many A4 pages as the data requires.
 *
 * The intake form gets its own nested section layout (matches the
 * editor); other form types fall back to the flat-field renderer
 * driven by FORM_DEFINITIONS.
 */
import { createPortal } from "react-dom";
import type { FormRequest } from "../api/forms-api";
import { FORM_DEFINITIONS, type FormField } from "../schemas";
import { FORM_TYPE_LABEL } from "../utils";
import { formatDate } from "@/lib/utils";

interface Props {
  form: FormRequest;
}

export function FormPrintLayout({ form }: Props) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="print-root print-only print-doc">
      <PrintHeader form={form} />
      <PrintPatientBanner form={form} />
      <PrintMetaBlock form={form} />
      {form.notes && (
        <PrintSection title="Note from requester">
          <p className="print-body-text whitespace-pre-wrap">{form.notes}</p>
        </PrintSection>
      )}
      <PrintBody form={form} />
      <PrintSignatureBlock form={form} />
      <PrintFooter />
    </div>,
    document.body
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

function PrintHeader({ form }: { form: FormRequest }) {
  return (
    <header className="print-header print-break-avoid">
      <div className="print-header__brand">
        <span className="print-header__logo" aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 32 32"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="32" height="32" rx="8" fill="#4F8CFF" />
            <path
              d="M16 9v14M9 16h14"
              stroke="#FFFFFF"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div>
          <div className="print-header__title">Modern-EHR</div>
          <div className="print-header__subtitle">AI-Native</div>
        </div>
      </div>
      <div className="print-header__tag">
        <span className="print-header__pill">Confidential</span>
        <div className="print-header__doctype">
          {FORM_TYPE_LABEL[form.formType]} form
        </div>
        <div className="print-header__docid">
          Document ID: {form.id.slice(0, 8).toUpperCase()}
        </div>
      </div>
    </header>
  );
}

function PrintPatientBanner({ form }: { form: FormRequest }) {
  const demo = ((form.data ?? {}) as { demographics?: Record<string, string> })
    .demographics;
  const dob = demo?.dob ? formatDate(demo.dob) : "—";
  return (
    <section className="print-banner print-break-avoid">
      <div>
        <div className="print-banner__label">Patient</div>
        <div className="print-banner__value">
          {form.patientName ?? "Unknown patient"}
        </div>
      </div>
      <div>
        <div className="print-banner__label">MRN</div>
        <div className="print-banner__value">{form.patientMrn ?? "—"}</div>
      </div>
      <div>
        <div className="print-banner__label">Date of birth</div>
        <div className="print-banner__value">{dob}</div>
      </div>
      <div>
        <div className="print-banner__label">Status</div>
        <div className="print-banner__value capitalize">{form.status}</div>
      </div>
    </section>
  );
}

function PrintMetaBlock({ form }: { form: FormRequest }) {
  return (
    <section className="print-meta print-break-avoid">
      <MetaCell label="Requested by" value={form.requestedByName ?? "—"} />
      <MetaCell label="Requested on" value={formatDate(form.createdAt)} />
      <MetaCell
        label="Due"
        value={form.dueDate ? formatDate(form.dueDate) : "—"}
      />
      <MetaCell
        label="Submitted by"
        value={form.submittedByName ?? "—"}
      />
      <MetaCell
        label="Submitted on"
        value={form.submittedAt ? formatDate(form.submittedAt) : "—"}
      />
      <MetaCell
        label="Reviewed by"
        value={form.reviewedByName ?? "—"}
      />
      {form.reviewedAt && (
        <MetaCell label="Reviewed on" value={formatDate(form.reviewedAt)} />
      )}
      {form.reviewNotes && (
        <MetaCell label="Review note" value={form.reviewNotes} />
      )}
    </section>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="print-meta__cell">
      <div className="print-meta__label">{label}</div>
      <div className="print-meta__value">{value}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Body — route per form type                                                  */
/* -------------------------------------------------------------------------- */

function PrintBody({ form }: { form: FormRequest }) {
  if (!form.data) {
    return (
      <PrintSection title="Submitted answers">
        <p className="print-body-text italic" style={{ color: "#64748b" }}>
          The form has not been filled out yet.
        </p>
      </PrintSection>
    );
  }
  if (form.formType === "intake") {
    return <IntakePrintBody data={form.data as IntakeData} />;
  }
  return <GenericPrintBody form={form} />;
}

/* -------------------------------------------------------------------------- */
/* Intake print body                                                          */
/* -------------------------------------------------------------------------- */

interface IntakeData {
  demographics?: Record<string, string>;
  contact?: Record<string, string>;
  insurance?: Record<string, string | null>;
  health_history?: {
    childhood_illnesses?: string[];
    diagnosed_problems?: string;
    past_surgeries?: Array<Record<string, string>>;
    current_medications?: Array<Record<string, string>>;
    allergies?: Array<Record<string, string>>;
  };
  family_health_history?: {
    conditions?: Array<Record<string, string>>;
  };
}

function IntakePrintBody({ data }: { data: IntakeData }) {
  const d = data.demographics ?? {};
  const c = data.contact ?? {};
  const ins = data.insurance ?? {};
  const h = data.health_history ?? {};
  const f = data.family_health_history ?? {};

  return (
    <>
      <PrintSection title="Demographics">
        <PrintGrid>
          <PrintCell label="First name" value={d.first_name} />
          <PrintCell label="Middle name" value={d.middle_name} />
          <PrintCell label="Last name" value={d.last_name} />
          <PrintCell label="Suffix" value={d.suffix} />
          <PrintCell label="Nickname" value={d.nickname} />
          <PrintCell label="Gender at birth" value={d.gender_at_birth} />
          <PrintCell label="Current gender" value={d.current_gender} />
          <PrintCell label="Pronouns" value={d.pronouns} />
          <PrintCell label="Date of birth" value={fmtDate(d.dob)} />
          <PrintCell label="Marital status" value={d.marital_status} />
          <PrintCell label="Time zone" value={d.time_zone} />
          <PrintCell label="Preferred language" value={d.preferred_language} />
          <PrintCell label="Occupation" value={d.occupation} />
          <PrintCell label="SSN" value={maskSsn(d.ssn)} />
          <PrintCell label="Race" value={d.race} />
          <PrintCell label="Ethnicity" value={d.ethnicity} />
        </PrintGrid>
      </PrintSection>

      <PrintSection title="Contact">
        <PrintGrid>
          <PrintCell label="Mobile number" value={c.mobile_number} />
          <PrintCell label="Home number" value={c.home_number} />
          <PrintCell label="Email" value={c.email} />
          <PrintCell label="Fax number" value={c.fax_number} />
          <PrintCell label="Address line 1" value={c.address_line_1} colSpan={2} />
          <PrintCell label="Address line 2" value={c.address_line_2} colSpan={2} />
          <PrintCell label="City" value={c.city} />
          <PrintCell label="State" value={c.state} />
          <PrintCell label="Country" value={c.country} />
          <PrintCell label="Zip code" value={c.zip_code} />
        </PrintGrid>
      </PrintSection>

      <PrintSection title="Insurance">
        <PrintGrid>
          <PrintCell label="Insurance name" value={ins.insurance_name as string | undefined} />
          <PrintCell label="Member ID" value={ins.member_id as string | undefined} />
          <PrintCell label="Insurance plan" value={ins.insurance_plan as string | undefined} />
          <PrintCell label="Insured group name" value={ins.insured_group_name as string | undefined} />
          <PrintCell label="Group number" value={ins.group_number as string | undefined} />
          <PrintCell
            label="Effective start date"
            value={fmtDate(ins.effective_start_date as string | undefined)}
          />
          <PrintCell
            label="Effective end date"
            value={fmtDate(ins.effective_end_date as string | undefined)}
          />
        </PrintGrid>
      </PrintSection>

      <PrintSection title="Patient health history">
        <PrintGrid>
          <PrintCell
            label="Childhood illnesses"
            value={(h.childhood_illnesses ?? []).join(", ")}
            colSpan={4}
          />
          <PrintCell
            label="Diagnosed problems"
            value={h.diagnosed_problems}
            colSpan={4}
          />
        </PrintGrid>

        <PrintTable
          label="Past surgeries"
          columns={["Surgery", "Onset date", "Hospital", "Note"]}
          items={h.past_surgeries ?? []}
          row={(s) => [s.name, fmtDate(s.onset_date), s.hospital, s.note]}
        />
        <PrintTable
          label="Current medications"
          columns={["Medication", "Frequency", "Note"]}
          items={h.current_medications ?? []}
          row={(m) => [m.name, m.frequency, m.note]}
        />
        <PrintTable
          label="Allergies"
          columns={["Type", "Name", "Description"]}
          items={h.allergies ?? []}
          row={(a) => [a.type, a.name, a.description]}
        />
      </PrintSection>

      <PrintSection title="Family health history">
        <PrintTable
          label="Family conditions"
          columns={["Condition", "Relation", "Onset date", "Note"]}
          items={f.conditions ?? []}
          row={(c2) => [
            c2.condition_name,
            c2.relation,
            fmtDate(c2.onset_date),
            c2.note,
          ]}
        />
      </PrintSection>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Generic fallback for non-intake form types                                 */
/* -------------------------------------------------------------------------- */

function GenericPrintBody({ form }: { form: FormRequest }) {
  const def = FORM_DEFINITIONS[form.formType];
  return (
    <PrintSection title="Submitted answers">
      <PrintGrid>
        {def.fields.map((field) => (
          <PrintCell
            key={field.name}
            label={field.label}
            value={renderGenericValue(field, form.data?.[field.name])}
            colSpan={field.fullWidth ? 4 : 2}
          />
        ))}
      </PrintGrid>
    </PrintSection>
  );
}

function renderGenericValue(field: FormField, value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (field.kind === "checkbox") return value === true ? "Yes" : "No";
  if (field.kind === "checkbox-group" && Array.isArray(value)) {
    return (value as string[])
      .map((v) => field.options?.find((o) => o.value === v)?.label ?? v)
      .join(", ");
  }
  if (field.kind === "radio" && typeof value === "string") {
    return field.options?.find((o) => o.value === value)?.label ?? value;
  }
  if (field.kind === "date" && typeof value === "string") return formatDate(value);
  return String(value);
}

/* -------------------------------------------------------------------------- */
/* Section + cells                                                            */
/* -------------------------------------------------------------------------- */

function PrintSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="print-section">
      <h3 className="print-section__title print-break-avoid">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function PrintGrid({ children }: { children: React.ReactNode }) {
  return <div className="print-grid">{children}</div>;
}

function PrintCell({
  label,
  value,
  colSpan = 2,
}: {
  label: string;
  value: string | null | undefined;
  colSpan?: 1 | 2 | 3 | 4;
}) {
  const display = value && String(value).trim() ? String(value) : null;
  return (
    <div
      className="print-cell print-break-avoid"
      style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
    >
      <div className="print-cell__label">{label}</div>
      <div className="print-cell__value">
        {display ?? <span className="print-cell__empty">—</span>}
      </div>
    </div>
  );
}

function PrintTable<T extends object>({
  label,
  columns,
  items,
  row,
}: {
  label: string;
  columns: string[];
  items: T[];
  row: (item: T) => Array<string | null | undefined>;
}) {
  if (items.length === 0) {
    return (
      <div className="print-table-empty print-break-avoid">
        <span className="print-table-empty__label">{label}</span>
        <span className="print-table-empty__value">None reported</span>
      </div>
    );
  }
  return (
    <div className="print-table-wrap">
      <div className="print-table__label">{label}</div>
      <table className="print-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="print-break-avoid">
              {row(item).map((cell, cIdx) => (
                <td key={cIdx}>
                  {cell && String(cell).trim() ? (
                    String(cell)
                  ) : (
                    <span className="print-cell__empty">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Signature + footer                                                         */
/* -------------------------------------------------------------------------- */

function PrintSignatureBlock({ form }: { form: FormRequest }) {
  return (
    <section className="print-signature print-break-avoid">
      <div className="print-signature__row">
        <div className="print-signature__field">
          <div className="print-signature__line" />
          <div className="print-signature__caption">
            Patient signature
          </div>
        </div>
        <div className="print-signature__field">
          <div className="print-signature__line" />
          <div className="print-signature__caption">Date</div>
        </div>
      </div>
      <div className="print-signature__row">
        <div className="print-signature__field">
          <div className="print-signature__line" />
          <div className="print-signature__caption">
            Provider signature {form.reviewedByName ? `· ${form.reviewedByName}` : ""}
          </div>
        </div>
        <div className="print-signature__field">
          <div className="print-signature__line" />
          <div className="print-signature__caption">Date</div>
        </div>
      </div>
    </section>
  );
}

function PrintFooter() {
  return (
    <footer className="print-footer print-break-avoid">
      <span>
        Generated by Modern-EHR · {formatDate(new Date().toISOString())}
      </span>
      <span>
        This document contains protected health information (PHI). Handle
        in accordance with HIPAA.
      </span>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */

function fmtDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return formatDate(value);
}

function maskSsn(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 9) return `•••-••-${digits.slice(-4)}`;
  return value;
}
