import { api } from "@/lib/api-client";
import { stripUndefined } from "@/lib/api-utils";

export type AlertSeverity = "critical" | "warning" | "info";

export interface PatientAlert {
  id: string;
  patientId: string;
  severity: AlertSeverity;
  label: string;
  detail: string | null;
  resolved: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BackendAlertDto {
  id: string;
  patient_id: string;
  severity: AlertSeverity;
  label: string;
  detail?: string | null;
  resolved: boolean;
  created_by_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertInput {
  patient_id: string;
  severity: AlertSeverity;
  label: string;
  detail?: string | null;
}

function mapAlert(dto: BackendAlertDto): PatientAlert {
  return {
    id: dto.id,
    patientId: dto.patient_id,
    severity: dto.severity,
    label: dto.label,
    detail: dto.detail ?? null,
    resolved: dto.resolved,
    createdById: dto.created_by_id ?? null,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function alertToBackendDto(a: PatientAlert): BackendAlertDto {
  return {
    id: a.id,
    patient_id: a.patientId,
    severity: a.severity,
    label: a.label,
    detail: a.detail,
    resolved: a.resolved,
    created_by_id: a.createdById,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  };
}

export const alertsApi = {
  listForPatient: async (
    patientId: string,
    opts?: { includeResolved?: boolean },
    fallback?: PatientAlert[]
  ): Promise<PatientAlert[]> => {
    const data = await api.get<BackendAlertDto[]>(
      `/alerts/patient/${patientId}`,
      {
        searchParams: {
          include_resolved: opts?.includeResolved ? "true" : undefined,
        },
        demoFallback: fallback ? () => fallback.map(alertToBackendDto) : undefined,
      }
    );
    return data.map(mapAlert);
  },

  create: async (input: AlertInput): Promise<PatientAlert> => {
    const dto = await api.post<BackendAlertDto>("/alerts", stripUndefined(input));
    return mapAlert(dto);
  },

  update: async (
    id: string,
    input: Partial<Omit<AlertInput, "patient_id">> & { resolved?: boolean }
  ): Promise<PatientAlert> => {
    const dto = await api.patch<BackendAlertDto>(`/alerts/${id}`, stripUndefined(input));
    return mapAlert(dto);
  },

  remove: (id: string): Promise<void> => api.delete(`/alerts/${id}`),
};
