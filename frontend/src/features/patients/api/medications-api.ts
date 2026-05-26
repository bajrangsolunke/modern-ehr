import { api } from "@/lib/api-client";
import type { Medication, MedicationStatus } from "@/types";

interface BackendMedicationDto {
  id: string;
  patient_id: string;
  name: string;
  dose: string;
  frequency: string;
  route: string;
  rxnorm?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status: MedicationStatus;
  prescriber?: string | null;
}

export interface MedicationInput {
  patient_id: string;
  name: string;
  dose: string;
  frequency: string;
  route?: string;
  rxnorm?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: MedicationStatus;
  prescriber?: string | null;
}

function mapMedication(dto: BackendMedicationDto): Medication {
  return {
    id: dto.id,
    patientId: dto.patient_id,
    name: dto.name,
    dose: dto.dose,
    frequency: dto.frequency,
    route: dto.route,
    rxnorm: dto.rxnorm ?? undefined,
    startDate: dto.start_date ?? "",
    endDate: dto.end_date ?? undefined,
    status: dto.status,
    prescriber: dto.prescriber ?? "",
  };
}

function medicationToBackendDto(m: Medication): BackendMedicationDto {
  return {
    id: m.id,
    patient_id: m.patientId ?? "",
    name: m.name,
    dose: m.dose,
    frequency: m.frequency,
    route: m.route,
    rxnorm: m.rxnorm ?? null,
    start_date: m.startDate || null,
    end_date: m.endDate ?? null,
    status: m.status,
    prescriber: m.prescriber || null,
  };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

export const medicationsApi = {
  listForPatient: async (
    patientId: string,
    fallback?: Medication[]
  ): Promise<Medication[]> => {
    const data = await api.get<BackendMedicationDto[]>(
      `/medications/patient/${patientId}`,
      {
        demoFallback: fallback ? () => fallback.map(medicationToBackendDto) : undefined,
      }
    );
    return data.map(mapMedication);
  },

  create: async (input: MedicationInput): Promise<Medication> => {
    const dto = await api.post<BackendMedicationDto>(
      "/medications",
      stripUndefined(input)
    );
    return mapMedication(dto);
  },

  update: async (
    id: string,
    input: Partial<Omit<MedicationInput, "patient_id">>
  ): Promise<Medication> => {
    const dto = await api.patch<BackendMedicationDto>(
      `/medications/${id}`,
      stripUndefined(input)
    );
    return mapMedication(dto);
  },

  remove: (id: string): Promise<void> => api.delete(`/medications/${id}`),
};
