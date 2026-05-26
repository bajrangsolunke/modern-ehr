import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { patientsApi, type PatientFilters } from "@/features/patients/api/patients-api";
import { QUERY_KEYS, PAGE_SIZE } from "@/config/constants";
import { patients as mockPatients } from "@/mocks";
import type { Patient } from "@/types";

export function usePatients(filters: PatientFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.patients.list(filters),
    queryFn: () => {
      const filtered = applyFilters(mockPatients, filters);
      const page = filters.page ?? 1;
      const size = filters.page_size ?? PAGE_SIZE;
      const items = filtered.slice((page - 1) * size, page * size);
      return patientsApi.list(filters, { items, total: filtered.length });
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
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
  return out;
}
