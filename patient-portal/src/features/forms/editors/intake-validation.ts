/**
 * Intake form validation — mirrors the backend Pydantic schema in
 * backend/app/schemas/form_request.py (IntakeFormPayload).
 *
 * Two entry points:
 *   - validateIntake(value): client-side check, runs before submit
 *   - mapBackendErrorsToIntake(errors): translates a 422 payload
 *     (Pydantic loc/msg list) into the same nested error shape, so
 *     anything the BE catches that we missed still shows inline.
 */
import { ApiError } from "@/lib/api-client";

/** Max lengths from the backend schema. Used for both `maxLength` on
 *  inputs (hard cap on typing/paste) and validation messages. */
export const INTAKE_LIMITS = {
  demographics: {
    first_name: 128,
    middle_name: 128,
    last_name: 128,
    suffix: 16,
    nickname: 128,
    gender_at_birth: 32,
    current_gender: 32,
    pronouns: 32,
    marital_status: 32,
    time_zone: 64,
    preferred_language: 64,
    occupation: 128,
    ssn: 32,
    race: 64,
    ethnicity: 64,
  },
  contact: {
    mobile_number: 64,
    home_number: 64,
    email: 255,
    fax_number: 64,
    address_line_1: 255,
    address_line_2: 255,
    city: 128,
    state: 64,
    country: 64,
    zip_code: 16,
  },
  insurance: {
    insurance_name: 255,
    member_id: 128,
    insurance_plan: 255,
    insured_group_name: 255,
    group_number: 128,
  },
  past_surgery: { name: 255, hospital: 255, note: 2000 },
  current_medication: { name: 255, frequency: 128, note: 2000 },
  allergy: { type: 64, name: 255, description: 2000 },
  family_condition: { condition_name: 255, relation: 64, note: 2000 },
  diagnosed_problems: 4000,
} as const;

export interface IntakeErrors {
  demographics: Partial<Record<keyof typeof INTAKE_LIMITS.demographics | "dob", string>>;
  contact: Partial<Record<keyof typeof INTAKE_LIMITS.contact, string>>;
  insurance: Partial<
    Record<
      | keyof typeof INTAKE_LIMITS.insurance
      | "effective_start_date"
      | "effective_end_date",
      string
    >
  >;
  health_history: {
    diagnosed_problems?: string;
    past_surgeries: Array<Partial<Record<"name" | "hospital" | "note" | "onset_date", string>>>;
    current_medications: Array<Partial<Record<"name" | "frequency" | "note", string>>>;
    allergies: Array<Partial<Record<"type" | "name" | "description", string>>>;
  };
  family_health_history: {
    conditions: Array<Partial<Record<"condition_name" | "relation" | "note" | "onset_date", string>>>;
  };
}

export function emptyIntakeErrors(): IntakeErrors {
  return {
    demographics: {},
    contact: {},
    insurance: {},
    health_history: {
      past_surgeries: [],
      current_medications: [],
      allergies: [],
    },
    family_health_history: { conditions: [] },
  };
}

/** True if any section has at least one error message. */
export function hasIntakeErrors(e: IntakeErrors): boolean {
  if (Object.keys(e.demographics).length > 0) return true;
  if (Object.keys(e.contact).length > 0) return true;
  if (Object.keys(e.insurance).length > 0) return true;
  if (e.health_history.diagnosed_problems) return true;
  if (e.health_history.past_surgeries.some((r) => Object.keys(r).length > 0))
    return true;
  if (
    e.health_history.current_medications.some((r) => Object.keys(r).length > 0)
  )
    return true;
  if (e.health_history.allergies.some((r) => Object.keys(r).length > 0))
    return true;
  if (
    e.family_health_history.conditions.some((r) => Object.keys(r).length > 0)
  )
    return true;
  return false;
}

/** Which section has the first error — used to scroll/open on save. */
export function firstSectionWithError(e: IntakeErrors): string | null {
  if (Object.keys(e.demographics).length > 0) return "demographics";
  if (Object.keys(e.contact).length > 0) return "contact";
  if (Object.keys(e.insurance).length > 0) return "insurance";
  if (
    e.health_history.diagnosed_problems ||
    e.health_history.past_surgeries.some((r) => Object.keys(r).length > 0) ||
    e.health_history.current_medications.some((r) => Object.keys(r).length > 0) ||
    e.health_history.allergies.some((r) => Object.keys(r).length > 0)
  )
    return "health";
  if (e.family_health_history.conditions.some((r) => Object.keys(r).length > 0))
    return "family";
  return null;
}

/* -------------------------------------------------------------------------- */
/* Field helpers                                                              */
/* -------------------------------------------------------------------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function tooLong(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? `Must be ${max} characters or fewer` : null;
}

function requiredStr(value: string | null | undefined): string | null {
  return value && value.trim() ? null : "Required";
}

function validDate(value: string | null | undefined): boolean {
  if (!value) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/* -------------------------------------------------------------------------- */
/* Whole-payload validator                                                    */
/* -------------------------------------------------------------------------- */

interface IntakeShape {
  demographics: Record<string, string>;
  contact: Record<string, string>;
  insurance: Record<string, string | null>;
  health_history: {
    diagnosed_problems: string;
    past_surgeries: Array<{
      name: string;
      onset_date: string;
      hospital: string;
      note: string;
    }>;
    current_medications: Array<{
      name: string;
      frequency: string;
      note: string;
    }>;
    allergies: Array<{ type: string; name: string; description: string }>;
  };
  family_health_history: {
    conditions: Array<{
      condition_name: string;
      relation: string;
      onset_date: string;
      note: string;
    }>;
  };
}

export function validateIntake(v: IntakeShape): IntakeErrors {
  const errors = emptyIntakeErrors();

  // Demographics — required: first_name, last_name, dob
  const d = v.demographics;
  const dErr = errors.demographics;
  dErr.first_name = requiredStr(d.first_name) ?? tooLong(d.first_name, INTAKE_LIMITS.demographics.first_name) ?? undefined;
  dErr.last_name = requiredStr(d.last_name) ?? tooLong(d.last_name, INTAKE_LIMITS.demographics.last_name) ?? undefined;
  dErr.middle_name = tooLong(d.middle_name, INTAKE_LIMITS.demographics.middle_name) ?? undefined;
  dErr.suffix = tooLong(d.suffix, INTAKE_LIMITS.demographics.suffix) ?? undefined;
  dErr.nickname = tooLong(d.nickname, INTAKE_LIMITS.demographics.nickname) ?? undefined;
  dErr.time_zone = tooLong(d.time_zone, INTAKE_LIMITS.demographics.time_zone) ?? undefined;
  dErr.preferred_language = tooLong(d.preferred_language, INTAKE_LIMITS.demographics.preferred_language) ?? undefined;
  dErr.occupation = tooLong(d.occupation, INTAKE_LIMITS.demographics.occupation) ?? undefined;
  dErr.ssn = tooLong(d.ssn, INTAKE_LIMITS.demographics.ssn) ?? undefined;

  if (!d.dob) {
    dErr.dob = "Required";
  } else if (!validDate(d.dob)) {
    dErr.dob = "Enter a valid date";
  } else if (new Date(d.dob).getTime() > Date.now()) {
    dErr.dob = "Date of birth can't be in the future";
  }

  // Contact
  const c = v.contact;
  const cErr = errors.contact;
  cErr.mobile_number = tooLong(c.mobile_number, INTAKE_LIMITS.contact.mobile_number) ?? undefined;
  cErr.home_number = tooLong(c.home_number, INTAKE_LIMITS.contact.home_number) ?? undefined;
  cErr.fax_number = tooLong(c.fax_number, INTAKE_LIMITS.contact.fax_number) ?? undefined;
  cErr.address_line_1 = tooLong(c.address_line_1, INTAKE_LIMITS.contact.address_line_1) ?? undefined;
  cErr.address_line_2 = tooLong(c.address_line_2, INTAKE_LIMITS.contact.address_line_2) ?? undefined;
  cErr.city = tooLong(c.city, INTAKE_LIMITS.contact.city) ?? undefined;
  cErr.state = tooLong(c.state, INTAKE_LIMITS.contact.state) ?? undefined;
  cErr.country = tooLong(c.country, INTAKE_LIMITS.contact.country) ?? undefined;
  cErr.zip_code = tooLong(c.zip_code, INTAKE_LIMITS.contact.zip_code) ?? undefined;
  if (c.email) {
    if (c.email.length > INTAKE_LIMITS.contact.email) {
      cErr.email = `Must be ${INTAKE_LIMITS.contact.email} characters or fewer`;
    } else if (!EMAIL_RE.test(c.email)) {
      cErr.email = "Enter a valid email address";
    }
  }

  // Insurance
  const ins = v.insurance;
  const iErr = errors.insurance;
  iErr.insurance_name = tooLong(ins.insurance_name, INTAKE_LIMITS.insurance.insurance_name) ?? undefined;
  iErr.member_id = tooLong(ins.member_id, INTAKE_LIMITS.insurance.member_id) ?? undefined;
  iErr.insurance_plan = tooLong(ins.insurance_plan, INTAKE_LIMITS.insurance.insurance_plan) ?? undefined;
  iErr.insured_group_name = tooLong(ins.insured_group_name, INTAKE_LIMITS.insurance.insured_group_name) ?? undefined;
  iErr.group_number = tooLong(ins.group_number, INTAKE_LIMITS.insurance.group_number) ?? undefined;

  const start = (ins.effective_start_date as string) || "";
  const end = (ins.effective_end_date as string) || "";
  if (start && !validDate(start)) iErr.effective_start_date = "Enter a valid date";
  if (end && !validDate(end)) iErr.effective_end_date = "Enter a valid date";
  if (start && end && validDate(start) && validDate(end) && start > end) {
    iErr.effective_end_date = "End date must be on or after start date";
  }

  // Health history
  const h = v.health_history;
  const hErr = errors.health_history;
  const dp = tooLong(h.diagnosed_problems, INTAKE_LIMITS.diagnosed_problems);
  if (dp) hErr.diagnosed_problems = dp;

  hErr.past_surgeries = h.past_surgeries.map((row) => {
    const e: IntakeErrors["health_history"]["past_surgeries"][number] = {};
    const n = tooLong(row.name, INTAKE_LIMITS.past_surgery.name);
    if (n) e.name = n;
    const hp = tooLong(row.hospital, INTAKE_LIMITS.past_surgery.hospital);
    if (hp) e.hospital = hp;
    const nt = tooLong(row.note, INTAKE_LIMITS.past_surgery.note);
    if (nt) e.note = nt;
    if (row.onset_date && !validDate(row.onset_date)) e.onset_date = "Enter a valid date";
    return e;
  });

  hErr.current_medications = h.current_medications.map((row) => {
    const e: IntakeErrors["health_history"]["current_medications"][number] = {};
    const n = tooLong(row.name, INTAKE_LIMITS.current_medication.name);
    if (n) e.name = n;
    const f = tooLong(row.frequency, INTAKE_LIMITS.current_medication.frequency);
    if (f) e.frequency = f;
    const nt = tooLong(row.note, INTAKE_LIMITS.current_medication.note);
    if (nt) e.note = nt;
    return e;
  });

  hErr.allergies = h.allergies.map((row) => {
    const e: IntakeErrors["health_history"]["allergies"][number] = {};
    const t = tooLong(row.type, INTAKE_LIMITS.allergy.type);
    if (t) e.type = t;
    const n = tooLong(row.name, INTAKE_LIMITS.allergy.name);
    if (n) e.name = n;
    const d2 = tooLong(row.description, INTAKE_LIMITS.allergy.description);
    if (d2) e.description = d2;
    return e;
  });

  // Family health history
  errors.family_health_history.conditions = v.family_health_history.conditions.map(
    (row) => {
      const e: IntakeErrors["family_health_history"]["conditions"][number] = {};
      const c2 = tooLong(row.condition_name, INTAKE_LIMITS.family_condition.condition_name);
      if (c2) e.condition_name = c2;
      const r = tooLong(row.relation, INTAKE_LIMITS.family_condition.relation);
      if (r) e.relation = r;
      const nt = tooLong(row.note, INTAKE_LIMITS.family_condition.note);
      if (nt) e.note = nt;
      if (row.onset_date && !validDate(row.onset_date)) e.onset_date = "Enter a valid date";
      return e;
    }
  );

  // Strip undefined-valued keys so hasIntakeErrors works by Object.keys count.
  pruneUndefined(errors.demographics);
  pruneUndefined(errors.contact);
  pruneUndefined(errors.insurance);

  return errors;
}

function pruneUndefined(obj: Record<string, string | undefined>): void {
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) delete obj[k];
  }
}

/* -------------------------------------------------------------------------- */
/* Backend → inline mapping                                                   */
/* -------------------------------------------------------------------------- */

interface PydanticError {
  type?: string;
  loc?: Array<string | number>;
  msg?: string;
  ctx?: { max_length?: number };
}

/** Pull a Pydantic-style error list from an ApiError payload. */
export function extractBackendErrors(err: unknown): PydanticError[] {
  if (!(err instanceof ApiError)) return [];
  const data = err.data as { detail?: unknown } | undefined;
  if (!data || typeof data !== "object") return [];
  const detail = data.detail;
  if (Array.isArray(detail)) return detail as PydanticError[];
  if (detail && typeof detail === "object") {
    const e = (detail as { errors?: unknown }).errors;
    if (Array.isArray(e)) return e as PydanticError[];
  }
  return [];
}

/** Map a Pydantic error list onto the intake error tree. Unknown paths
 *  are ignored. */
export function mapBackendErrorsToIntake(
  errs: PydanticError[],
  base: IntakeErrors = emptyIntakeErrors()
): IntakeErrors {
  const out = base;

  // Make sure the row-error arrays are long enough.
  const ensureRow = <T extends object>(arr: T[], idx: number): T => {
    while (arr.length <= idx) arr.push({} as T);
    return arr[idx];
  };

  for (const e of errs) {
    const loc = e.loc ?? [];
    if (!loc.length || !e.msg) continue;

    const section = loc[0];
    const friendly = friendlyMessage(e);

    if (section === "demographics" && typeof loc[1] === "string") {
      // Cast through unknown — the union of demographic field keys.
      (out.demographics as Record<string, string>)[loc[1]] = friendly;
    } else if (section === "contact" && typeof loc[1] === "string") {
      (out.contact as Record<string, string>)[loc[1]] = friendly;
    } else if (section === "insurance" && typeof loc[1] === "string") {
      (out.insurance as Record<string, string>)[loc[1]] = friendly;
    } else if (section === "health_history") {
      if (loc[1] === "diagnosed_problems") {
        out.health_history.diagnosed_problems = friendly;
      } else if (
        (loc[1] === "past_surgeries" ||
          loc[1] === "current_medications" ||
          loc[1] === "allergies") &&
        typeof loc[2] === "number" &&
        typeof loc[3] === "string"
      ) {
        const row = ensureRow(
          out.health_history[loc[1] as "past_surgeries" | "current_medications" | "allergies"],
          loc[2]
        );
        (row as Record<string, string>)[loc[3]] = friendly;
      }
    } else if (section === "family_health_history") {
      if (
        loc[1] === "conditions" &&
        typeof loc[2] === "number" &&
        typeof loc[3] === "string"
      ) {
        const row = ensureRow(
          out.family_health_history.conditions,
          loc[2]
        );
        (row as Record<string, string>)[loc[3]] = friendly;
      }
    }
  }
  return out;
}

function friendlyMessage(e: PydanticError): string {
  if (e.type === "string_too_long" && e.ctx?.max_length) {
    return `Must be ${e.ctx.max_length} characters or fewer`;
  }
  if (e.type === "missing") return "Required";
  if (e.type?.startsWith("value_error.email") || e.type === "value_error.email") {
    return "Enter a valid email address";
  }
  if (e.type === "date_from_datetime_parsing" || e.type === "date_parsing") {
    return "Enter a valid date";
  }
  return e.msg ?? "Invalid value";
}
