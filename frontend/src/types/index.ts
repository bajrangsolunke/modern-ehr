export type Role = "provider" | "staff" | "admin";

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export type PatientStatus = "ready" | "at-risk" | "in-progress" | "discharged" | "scheduled";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  specialty?: string;
}

export interface Patient {
  id: string;
  mrn: string;
  /** Convenience: `${firstName} ${lastName}`. Prefer the explicit fields for
   *  form fields, splitting, etc. — multi-part last names get mangled by
   *  naive whitespace splits on `name`. */
  name: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  age: number;
  sex: "F" | "M" | "O";
  dob: string;
  email?: string;
  phone?: string;
  city?: string;
  procedure: string;
  status: PatientStatus;
  procedureDate: string;
  /**
   * The provider this patient is assigned to. `id` is the FK and is
   * what the picker writes back; `name` is for display only.
   */
  assignedPhysician: { id?: string; name: string; avatarUrl?: string };
  tags: string[];
  /** Controlled-vocabulary chip — drives the Communication filter and
   *  future analytics roll-ups. Distinct from the free-form `tags`. */
  conditionTag?: string;
  risk: RiskLevel;
  asa?: "I" | "II" | "III" | "IV";
  icu?: boolean;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: "critical" | "warning" | "info" | "success";
  source: "ai" | "lab" | "system";
  timestamp: string;
  patientId?: string;
}

export type AppointmentType =
  | "consultation"
  | "surgery"
  | "diagnosis"
  | "biopsy"
  | "follow-up";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "pending"
  | "completed"
  | "cancelled"
  | "no-show";

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientMrn?: string;
  patientAvatarUrl?: string;
  physicianId?: string;
  physician: string;
  type: AppointmentType;
  status: AppointmentStatus;
  /** ISO timestamp of the slot start. */
  startsAt: string;
  /** Local date "Apr 03" — derived from startsAt for legacy callers. */
  date: string;
  /** Local time "9:30 AM" — derived. */
  time: string;
  duration: number;
  room?: string;
  reason?: string;
}

export interface VitalSign {
  label: string;
  value: string;
  unit: string;
  trend?: "up" | "down" | "flat";
  status?: "normal" | "elevated" | "low" | "critical";
}

export type MedicationStatus = "active" | "paused" | "discontinued";

export interface Medication {
  id: string;
  patientId?: string;
  name: string;
  dose: string;
  frequency: string;
  route: string;
  rxnorm?: string;
  startDate: string;
  endDate?: string;
  status: MedicationStatus;
  prescriber: string;
}

export interface LabResult {
  id: string;
  name: string;
  value: string;
  unit: string;
  range: string;
  flag?: "H" | "L" | "C";
  collectedAt: string;
}

export interface SoapNote {
  id: string;
  patientId?: string;
  authorId?: string;
  /** When this note was created. ISO timestamp. */
  date: string;
  /** Display name of the author. Backend may not always have this; fallback to a dash. */
  author: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  aiSummary?: string;
  version: number;
  updatedAt?: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  type: "encounter" | "procedure" | "lab" | "imaging" | "note" | "medication";
  title: string;
  detail: string;
  author?: string;
}

export interface KpiCard {
  label: string;
  value: string | number;
  delta?: { value: number; positive?: boolean };
  hint?: string;
  icon?: string;
}

export interface ChartPoint {
  label: string;
  [key: string]: number | string;
}

export interface AiInsight {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  category: "risk" | "trend" | "operations" | "outcome";
  actions?: string[];
}
