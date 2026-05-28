import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  patientsApi,
  type PatientFilters,
  type PatientSortBy,
} from "@/features/patients/api/patients-api";
import { QUERY_KEYS, PAGE_SIZE } from "@/config/constants";
import { patients as mockPatients } from "@/mocks";
import type { Patient } from "@/types";

export function usePatients(
  filters: PatientFilters,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: QUERY_KEYS.patients.list(filters),
    queryFn: () => {
      const filtered = applyFilters(mockPatients, filters);
      const sorted = applySort(filtered, filters);
      const page = filters.page ?? 1;
      const size = filters.page_size ?? PAGE_SIZE;
      const items = sorted.slice((page - 1) * size, page * size);
      return patientsApi.list(filters, { items, total: sorted.length });
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });
}

function applyFilters(items: Patient[], f: PatientFilters): Patient[] {
  const q = f.q?.toLowerCase().trim();
  let out = items;
  if (q) {
    out = out.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.mrn.includes(q) ||
        p.procedure.toLowerCase().includes(q)
    );
  }
  if (f.status) out = out.filter((p) => p.status === f.status);
  if (f.risk) out = out.filter((p) => p.risk === f.risk);
  if (f.asa) out = out.filter((p) => p.asa === f.asa);
  if (f.icu_needed !== undefined) {
    out = out.filter((p) => Boolean(p.icu) === f.icu_needed);
  }
  // physician_id filter is intentionally not applied to the demo data —
  // the mock patients don't carry a backend physician UUID.
  return out;
}

function applySort(items: Patient[], f: PatientFilters): Patient[] {
  const by: PatientSortBy = f.sort_by ?? "created_at";
  const dir = f.sort_dir === "asc" ? 1 : -1;
  const get = (p: Patient): string | number => {
    switch (by) {
      case "mrn":
        return p.mrn;
      case "first_name":
        return p.firstName;
      case "procedure_date":
        return p.procedureDate;
      case "risk_score":
        return riskRank(p.risk);
      case "created_at":
      default:
        return p.id; // mock has no created_at; id is stable insertion order
    }
  };
  return [...items].sort((a, b) => {
    const av = get(a);
    const bv = get(b);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

function riskRank(r: Patient["risk"]): number {
  return { low: 1, moderate: 2, high: 3, critical: 4 }[r] ?? 0;
}
