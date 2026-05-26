import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { patientsApi, type PatientFilters } from "@/features/patients/api/patients-api";
import { QUERY_KEYS, PAGE_SIZE } from "@/config/constants";
import { patients as mockPatients } from "@/mocks";

export function usePatients(filters: PatientFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.patients.list(filters),
    queryFn: () =>
      patientsApi.list(filters, {
        items: applyClientFilters(mockPatients, filters),
        total: applyClientFilters(mockPatients, filters).length,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

function applyClientFilters(items: typeof mockPatients, f: PatientFilters) {
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
  const page = f.page ?? 1;
  const size = f.page_size ?? PAGE_SIZE;
  return out.slice((page - 1) * size, page * size);
}
