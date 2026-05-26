import { api } from "@/lib/api-client";
import type { Patient } from "@/types";

interface BackendPatientDto {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  sex: "F" | "M" | "O";
  dob: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  avatar_url?: string | null;
  procedure?: string | null;
  procedure_date?: string | null;
  asa?: "I" | "II" | "III" | "IV" | null;
  icu_needed: boolean;
  status: Patient["status"];
  risk: Patient["risk"];
  risk_score: number;
  tags?: string[] | null;
  assigned_physician_id: string | null;
}

interface PageDto<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export type PatientSortBy =
  | "mrn"
  | "first_name"
  | "procedure_date"
  | "risk_score"
  | "created_at";
export type PatientSortDir = "asc" | "desc";

export interface PatientFilters {
  q?: string;
  status?: Patient["status"];
  risk?: Patient["risk"];
  asa?: "I" | "II" | "III" | "IV";
  icu_needed?: boolean;
  physician_id?: string;
  sort_by?: PatientSortBy;
  sort_dir?: PatientSortDir;
  page?: number;
  page_size?: number;
}

export interface PatientPage {
  items: Patient[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

function mapPatient(dto: BackendPatientDto): Patient {
  const firstName = dto.first_name ?? "";
  const lastName = dto.last_name ?? "";
  const fullName = `${firstName} ${lastName}`.trim() || "Unknown";
  return {
    id: dto.id,
    mrn: dto.mrn,
    name: fullName,
    firstName,
    lastName,
    sex: dto.sex,
    dob: dto.dob ?? "",
    email: dto.email ?? undefined,
    phone: dto.phone ?? undefined,
    city: dto.city ?? undefined,
    avatarUrl: dto.avatar_url ?? undefined,
    age: computeAge(dto.dob),
    procedure: dto.procedure ?? "",
    status: dto.status,
    procedureDate: dto.procedure_date ?? "",
    assignedPhysician: { name: "—" },
    tags: dto.tags ?? [],
    risk: dto.risk,
    asa: dto.asa ?? undefined,
    icu: dto.icu_needed,
  };
}

/**
 * Computes whole-year age from a YYYY-MM-DD date string. Subtract 1 if this
 * year's birthday hasn't happened yet — the prior naive `diff / 365.25`
 * formula was off by a day around birthdays.
 */
function computeAge(dob: string | null | undefined): number {
  if (!dob || typeof dob !== "string") return 0;
  const [y, m, d] = dob.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const today = new Date();
  let age = today.getFullYear() - y;
  const monthDelta = today.getMonth() + 1 - m;
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < d)) {
    age -= 1;
  }
  return Math.max(0, age);
}

export const patientsApi = {
  list: async (
    filters: PatientFilters,
    fallback?: { items: Patient[]; total: number }
  ): Promise<PatientPage> => {
    const data = await api.get<PageDto<BackendPatientDto>>("/patients", {
      searchParams: {
        q: filters.q,
        status: filters.status,
        risk: filters.risk,
        asa: filters.asa,
        icu_needed: filters.icu_needed,
        physician_id: filters.physician_id,
        sort_by: filters.sort_by,
        sort_dir: filters.sort_dir,
        page: filters.page ?? 1,
        page_size: filters.page_size ?? 20,
      },
      demoFallback: fallback
        ? () => ({
            items: fallback.items.map(patientToBackendDto),
            total: fallback.total,
            page: filters.page ?? 1,
            page_size: filters.page_size ?? 20,
            pages: Math.max(1, Math.ceil(fallback.total / (filters.page_size ?? 20))),
          })
        : undefined,
    });
    return {
      items: data.items.map(mapPatient),
      total: data.total,
      page: data.page,
      page_size: data.page_size,
      pages: data.pages,
    };
  },

  get: async (id: string, fallback?: Patient): Promise<Patient> => {
    const dto = await api.get<BackendPatientDto>(`/patients/${id}`, {
      demoFallback: fallback ? () => patientToBackendDto(fallback) : undefined,
    });
    return mapPatient(dto);
  },

  create: async (input: PatientInput): Promise<Patient> => {
    const dto = await api.post<BackendPatientDto>(
      "/patients",
      inputToBackend(input)
    );
    return mapPatient(dto);
  },

  update: async (id: string, input: Partial<PatientInput>): Promise<Patient> => {
    const dto = await api.patch<BackendPatientDto>(
      `/patients/${id}`,
      inputToBackend(input)
    );
    return mapPatient(dto);
  },

  remove: (id: string): Promise<void> => api.delete(`/patients/${id}`),
};

export interface PatientInput {
  mrn?: string;
  first_name?: string;
  last_name?: string;
  sex?: "F" | "M" | "O";
  dob?: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  procedure?: string | null;
  procedure_date?: string | null;
  asa?: "I" | "II" | "III" | "IV" | null;
  icu_needed?: boolean;
  status?: Patient["status"];
  risk?: Patient["risk"];
  tags?: string[] | null;
  assigned_physician_id?: string | null;
}

function inputToBackend(input: Partial<PatientInput>): Record<string, unknown> {
  // Drop undefined keys so PATCH only sends the fields the caller set.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * Round-trip helper: convert a frontend Patient back into the backend DTO
 * shape. Used by the demo-mode fallback to feed mockPatients through the
 * same mapPatient pipeline as real responses (no parallel mapping logic).
 */
function patientToBackendDto(p: Patient): BackendPatientDto {
  return {
    id: p.id,
    mrn: p.mrn,
    first_name: p.firstName,
    last_name: p.lastName,
    sex: p.sex,
    dob: p.dob,
    email: p.email ?? null,
    phone: p.phone ?? null,
    city: p.city ?? null,
    avatar_url: p.avatarUrl ?? null,
    procedure: p.procedure || null,
    procedure_date: p.procedureDate || null,
    asa: p.asa ?? null,
    icu_needed: Boolean(p.icu),
    status: p.status,
    risk: p.risk,
    risk_score: 0,
    tags: p.tags ?? null,
    assigned_physician_id: null,
  };
}
