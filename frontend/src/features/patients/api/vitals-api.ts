import { api } from "@/lib/api-client";
import { stripUndefined } from "@/lib/api-utils";
import type { VitalMetricKey } from "@/features/patients/lib/vital-metrics";

export interface VitalReading {
  id: string;
  patientId: string;
  metric: VitalMetricKey;
  value: number;
  unit: string | null;
  source: "manual" | "device" | "imported";
  recordedAt: string;
}

interface BackendVitalDto {
  id: string;
  patient_id: string;
  metric: VitalMetricKey;
  value: number;
  unit?: string | null;
  source: "manual" | "device" | "imported";
  recorded_at: string;
}

export interface VitalInput {
  patient_id: string;
  metric: VitalMetricKey;
  value: number;
  unit?: string | null;
  source?: "manual" | "device" | "imported";
  recorded_at?: string | null;
}

function mapVital(dto: BackendVitalDto): VitalReading {
  return {
    id: dto.id,
    patientId: dto.patient_id,
    metric: dto.metric,
    value: Number(dto.value),
    unit: dto.unit ?? null,
    source: dto.source,
    recordedAt: dto.recorded_at,
  };
}

function vitalToBackendDto(v: VitalReading): BackendVitalDto {
  return {
    id: v.id,
    patient_id: v.patientId,
    metric: v.metric,
    value: v.value,
    unit: v.unit,
    source: v.source,
    recorded_at: v.recordedAt,
  };
}

export const vitalsApi = {
  listForPatient: async (
    patientId: string,
    opts?: { metric?: VitalMetricKey; sinceHours?: number; limit?: number },
    fallback?: VitalReading[]
  ): Promise<VitalReading[]> => {
    const data = await api.get<BackendVitalDto[]>(
      `/vitals/patient/${patientId}`,
      {
        searchParams: {
          metric: opts?.metric,
          since_hours: opts?.sinceHours,
          limit: opts?.limit,
        },
        demoFallback: fallback ? () => fallback.map(vitalToBackendDto) : undefined,
      }
    );
    return data.map(mapVital);
  },

  create: async (input: VitalInput): Promise<VitalReading> => {
    const dto = await api.post<BackendVitalDto>("/vitals", stripUndefined(input));
    return mapVital(dto);
  },

  update: async (
    id: string,
    input: Partial<Omit<VitalInput, "patient_id" | "metric">>
  ): Promise<VitalReading> => {
    const dto = await api.patch<BackendVitalDto>(`/vitals/${id}`, stripUndefined(input));
    return mapVital(dto);
  },

  remove: (id: string): Promise<void> => api.delete(`/vitals/${id}`),
};
