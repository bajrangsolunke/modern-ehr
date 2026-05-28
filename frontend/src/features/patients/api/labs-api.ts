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
  sourceDocumentId: string | null;
  sourceDocumentName: string | null;
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
  source_document_id: string | null;
  source_document_name: string | null;
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
    sourceDocumentId: dto.source_document_id ?? null,
    sourceDocumentName: dto.source_document_name ?? null,
  };
}

export interface ExtractedLabRow {
  name: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  flag: "H" | "L" | "C" | null;
}

export interface LabExtractionPreview {
  documentId: string;
  documentName: string;
  patientId: string;
  model: string;
  results: ExtractedLabRow[];
}

interface BackendExtractionPreviewDto {
  document_id: string;
  document_name: string;
  patient_id: string;
  model: string;
  results: Array<{
    name: string;
    value: string;
    unit: string | null;
    reference_range: string | null;
    flag: string | null;
  }>;
}

function mapExtractionPreview(
  dto: BackendExtractionPreviewDto
): LabExtractionPreview {
  return {
    documentId: dto.document_id,
    documentName: dto.document_name,
    patientId: dto.patient_id,
    model: dto.model,
    results: dto.results.map((r) => ({
      name: r.name,
      value: r.value,
      unit: r.unit ?? null,
      referenceRange: r.reference_range ?? null,
      flag:
        r.flag === "H" || r.flag === "L" || r.flag === "C" ? r.flag : null,
    })),
  };
}

export const labsApi = {
  listForPatient: async (patientId: string): Promise<LabResult[]> => {
    const data = await api.get<BackendLabDto[]>(`/labs/patient/${patientId}`);
    return data.map(mapLab);
  },

  extractPreview: async (documentId: string): Promise<LabExtractionPreview> => {
    const data = await api.post<BackendExtractionPreviewDto>(
      `/labs/extract/${documentId}/preview`,
      {}
    );
    return mapExtractionPreview(data);
  },

  batchCreate: async (input: {
    patient_id: string;
    source_document_id?: string;
    results: ExtractedLabRow[];
  }): Promise<LabResult[]> => {
    const body = {
      patient_id: input.patient_id,
      source_document_id: input.source_document_id ?? null,
      results: input.results.map((r) => ({
        name: r.name,
        value: r.value,
        unit: r.unit ?? null,
        reference_range: r.referenceRange ?? null,
        flag: r.flag ?? null,
      })),
    };
    const data = await api.post<BackendLabDto[]>(`/labs/batch`, body);
    return data.map(mapLab);
  },
};
