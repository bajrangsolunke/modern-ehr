/**
 * Patient-scoped structured lab results — values, ranges, flags. Lives
 * separately from `documents` (where lab REPORT PDFs are uploaded).
 */
import { api } from "@/lib/api-client";

export type LabFlag = "H" | "L" | "C" | null;

export interface LabResult {
  id: string;
  patientId: string;
  name: string;
  value: string;
  unit: string | null;
  loinc: string | null;
  referenceRange: string | null;
  flag: LabFlag;
  collectedAt: string;
}

interface BackendLabDto {
  id: string;
  patient_id: string;
  name: string;
  value: string;
  unit: string | null;
  loinc: string | null;
  reference_range: string | null;
  flag: string | null;
  collected_at: string;
}

function mapLab(dto: BackendLabDto): LabResult {
  return {
    id: dto.id,
    patientId: dto.patient_id,
    name: dto.name,
    value: dto.value,
    unit: dto.unit,
    loinc: dto.loinc,
    referenceRange: dto.reference_range,
    flag:
      dto.flag === "H" || dto.flag === "L" || dto.flag === "C"
        ? dto.flag
        : null,
    collectedAt: dto.collected_at,
  };
}

export const labsApi = {
  listForPatient: async (patientId: string): Promise<LabResult[]> => {
    const data = await api.get<BackendLabDto[]>(`/labs/patient/${patientId}`);
    return data.map(mapLab);
  },
};
