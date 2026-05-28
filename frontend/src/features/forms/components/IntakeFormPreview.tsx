/**
 * Read-only preview of a submitted intake form.
 *
 * The intake editor stores a nested payload (demographics / contact /
 * insurance / health_history / family_health_history) matching the
 * backend IntakeFormPayload. This component renders each section as a
 * labeled grid so reviewers can scan the answers — no editing.
 */
import { formatDate } from "@/lib/utils";

interface IntakeData {
  demographics?: Partial<{
    first_name: string;
    middle_name: string;
    last_name: string;
    suffix: string;
    nickname: string;
    gender_at_birth: string;
    current_gender: string;
    pronouns: string;
    dob: string;
    marital_status: string;
    time_zone: string;
    preferred_language: string;
    occupation: string;
    ssn: string;
    race: string;
    ethnicity: string;
  }>;
  contact?: Partial<{
    mobile_number: string;
    home_number: string;
    email: string;
    fax_number: string;
    address_line_1: string;
    address_line_2: string;
    city: string;
    state: string;
    country: string;
    zip_code: string;
  }>;
  insurance?: Partial<{
    insurance_name: string;
    member_id: string;
    insurance_plan: string;
    insured_group_name: string;
    group_number: string;
    effective_start_date: string;
    effective_end_date: string;
    card_front_url: string | null;
    card_back_url: string | null;
  }>;
  health_history?: Partial<{
    childhood_illnesses: string[];
    diagnosed_problems: string;
    past_surgeries: Array<
      Partial<{ name: string; onset_date: string; hospital: string; note: string }>
    >;
    current_medications: Array<
      Partial<{ name: string; frequency: string; note: string }>
    >;
    allergies: Array<
      Partial<{ type: string; name: string; description: string }>
    >;
  }>;
  family_health_history?: Partial<{
    conditions: Array<
      Partial<{
        condition_name: string;
        relation: string;
        onset_date: string;
        note: string;
      }>
    >;
  }>;
}

interface Props {
  data: IntakeData | null;
}

export function IntakeFormPreview({ data }: Props) {
  if (!data) {
    return (
      <p className="text-sm text-muted-foreground italic">
        The form hasn&apos;t been filled out yet.
      </p>
    );
  }

  const d = data.demographics ?? {};
  const c = data.contact ?? {};
  const ins = data.insurance ?? {};
  const h = data.health_history ?? {};
  const f = data.family_health_history ?? {};

  return (
    <div className="space-y-5">
      {/* Demographics */}
      <Section title="Demographics">
        <Grid>
          <Field label="First name" value={d.first_name} />
          <Field label="Middle name" value={d.middle_name} />
          <Field label="Last name" value={d.last_name} />
          <Field label="Suffix" value={d.suffix} />
          <Field label="Nickname" value={d.nickname} />
          <Field label="Gender at birth" value={d.gender_at_birth} />
          <Field label="Current gender" value={d.current_gender} />
          <Field label="Pronouns" value={d.pronouns} />
          <Field label="Date of birth" value={fmtDate(d.dob)} />
          <Field label="Marital status" value={d.marital_status} />
          <Field label="Time zone" value={d.time_zone} />
          <Field label="Preferred language" value={d.preferred_language} />
          <Field label="Occupation" value={d.occupation} />
          <Field label="SSN" value={maskSsn(d.ssn)} />
          <Field label="Race" value={d.race} />
          <Field label="Ethnicity" value={d.ethnicity} />
        </Grid>
      </Section>

      {/* Contact */}
      <Section title="Contact">
        <Grid>
          <Field label="Mobile number" value={c.mobile_number} />
          <Field label="Home number" value={c.home_number} />
          <Field label="Email" value={c.email} />
          <Field label="Fax number" value={c.fax_number} />
          <Field label="Address line 1" value={c.address_line_1} fullWidth />
          <Field label="Address line 2" value={c.address_line_2} fullWidth />
          <Field label="City" value={c.city} />
          <Field label="State" value={c.state} />
          <Field label="Country" value={c.country} />
          <Field label="Zip code" value={c.zip_code} />
        </Grid>
      </Section>

      {/* Insurance */}
      <Section title="Insurance">
        <Grid>
          <Field label="Insurance name" value={ins.insurance_name} />
          <Field label="Member ID" value={ins.member_id} />
          <Field label="Insurance plan" value={ins.insurance_plan} />
          <Field label="Insured group name" value={ins.insured_group_name} />
          <Field label="Group number" value={ins.group_number} />
          <Field
            label="Effective start date"
            value={fmtDate(ins.effective_start_date)}
          />
          <Field
            label="Effective end date"
            value={fmtDate(ins.effective_end_date)}
          />
        </Grid>
        {(ins.card_front_url || ins.card_back_url) && (
          <div className="flex flex-wrap gap-3 mt-3">
            {ins.card_front_url && (
              <CardImage label="Card front" url={ins.card_front_url} />
            )}
            {ins.card_back_url && (
              <CardImage label="Card back" url={ins.card_back_url} />
            )}
          </div>
        )}
      </Section>

      {/* Patient health history */}
      <Section title="Patient health history">
        <div className="space-y-3">
          <Field
            label="Childhood illnesses"
            value={(h.childhood_illnesses ?? []).join(", ")}
            fullWidth
          />
          <Field
            label="Diagnosed problems"
            value={h.diagnosed_problems}
            fullWidth
          />

          <ListBlock
            label="Past surgeries"
            items={h.past_surgeries ?? []}
            columns={["Name", "Onset date", "Hospital", "Note"]}
            row={(s) => [s.name, fmtDate(s.onset_date), s.hospital, s.note]}
          />

          <ListBlock
            label="Current medications"
            items={h.current_medications ?? []}
            columns={["Name", "Frequency", "Note"]}
            row={(m) => [m.name, m.frequency, m.note]}
          />

          <ListBlock
            label="Allergies"
            items={h.allergies ?? []}
            columns={["Type", "Name", "Description"]}
            row={(a) => [a.type, a.name, a.description]}
          />
        </div>
      </Section>

      {/* Family health history */}
      <Section title="Family health history">
        <ListBlock
          label="Family conditions"
          items={f.conditions ?? []}
          columns={["Condition", "Relation", "Onset date", "Note"]}
          row={(c2) => [
            c2.condition_name,
            c2.relation,
            fmtDate(c2.onset_date),
            c2.note,
          ]}
          hideLabel
        />
      </Section>
    </div>
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

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: string | null | undefined;
  fullWidth?: boolean;
}) {
  const display = value && String(value).trim() ? String(value) : null;
  return (
    <div
      className={
        "rounded-2xl bg-white border border-border px-3 py-2 print:border-border " +
        (fullWidth ? "sm:col-span-2 lg:col-span-4" : "")
      }
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="text-sm mt-0.5 whitespace-pre-wrap break-words">
        {display ?? <span className="text-muted-foreground italic">—</span>}
      </div>
    </div>
  );
}

function ListBlock<T extends object>({
  label,
  items,
  columns,
  row,
  hideLabel,
}: {
  label: string;
  items: T[];
  columns: string[];
  row: (item: T) => Array<string | null | undefined>;
  hideLabel?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white border border-border overflow-hidden">
      {!hideLabel && (
        <div className="px-3 py-2 border-b border-border bg-surface-subtle">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {label}
          </span>
        </div>
      )}
      {items.length === 0 ? (
        <div className="px-3 py-2.5 text-sm text-muted-foreground italic">
          None reported
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-subtle/60">
                {columns.map((c) => (
                  <th
                    key={c}
                    className="text-left px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const cells = row(item);
                return (
                  <tr key={idx} className="border-t border-border">
                    {cells.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className="px-3 py-2 align-top whitespace-pre-wrap break-words"
                      >
                        {cell && String(cell).trim() ? (
                          String(cell)
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CardImage({ label, url }: { label: string; url: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <img
        src={url}
        alt={label}
        className="max-h-40 rounded-xl border border-border"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function fmtDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return formatDate(value);
}

/** Show only the last 4 of a US-style SSN; pass through other strings. */
function maskSsn(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 9) return `•••-••-${digits.slice(-4)}`;
  return value;
}
