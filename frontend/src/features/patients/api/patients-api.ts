import { api } from "@/lib/api-client";
import type { Patient } from "@/types";

interface BackendPatientDto {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  sex: "F" | "M" | "O";
  dob: string;
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

export interface PatientFilters {
  q?: string;
  status?: Patient["status"];
  risk?: Patient["risk"];
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
  const age = computeAge(dto.dob);
  return {
    id: dto.id,
    mrn: dto.mrn,
    name: `${dto.first_name} ${dto.last_name}`,
    sex: dto.sex,
    dob: dto.dob,
    city: dto.city ?? undefined,
    avatarUrl: dto.avatar_url ?? undefined,
    age,
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

function computeAge(dob: string): number {
  const birth = new Date(dob);
  const diff = Date.now() - birth.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
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
        page: filters.page ?? 1,
        page_size: filters.page_size ?? 20,
      },
      demoFallback: fallback
        ? () => ({
            items: fallback.items.map((p) => ({
              id: p.id,
              mrn: p.mrn,
              first_name: p.name.split(" ")[0] ?? "",
              last_name: p.name.split(" ").slice(1).join(" "),
              sex: p.sex,
              dob: p.dob,
              city: p.city ?? null,
              avatar_url: p.avatarUrl ?? null,
              procedure: p.procedure,
              procedure_date: p.procedureDate,
              asa: p.asa ?? null,
              icu_needed: Boolean(p.icu),
              status: p.status,
              risk: p.risk,
              risk_score: 0,
              tags: p.tags ?? null,
              assigned_physician_id: null,
            })),
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
      demoFallback: fallback
        ? () => ({
            id: fallback.id,
            mrn: fallback.mrn,
            first_name: fallback.name.split(" ")[0] ?? "",
            last_name: fallback.name.split(" ").slice(1).join(" "),
            sex: fallback.sex,
            dob: fallback.dob,
            city: fallback.city ?? null,
            avatar_url: fallback.avatarUrl ?? null,
            procedure: fallback.procedure,
            procedure_date: fallback.procedureDate,
            asa: fallback.asa ?? null,
            icu_needed: Boolean(fallback.icu),
            status: fallback.status,
            risk: fallback.risk,
            risk_score: 0,
            tags: fallback.tags ?? null,
            assigned_physician_id: null,
          })
        : undefined,
    });
    return mapPatient(dto);
  },
};
