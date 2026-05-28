/**
 * AI endpoints scoped to the forms feature. Right now just the intake
 * summarizer — extend here when we add SOAP autodraft, coding, etc.
 */
import { api } from "@/lib/api-client";

export interface IntakeSummary {
  formId: string;
  patientId: string;
  summary: string;
  bullets: string[];
  redFlags: string[];
  followUps: string[];
  confidence: number;
  model: string;
  generatedAt: string;
}

interface BackendDto {
  form_id: string;
  patient_id: string;
  summary: string;
  bullets: string[];
  red_flags: string[];
  follow_ups: string[];
  confidence: number;
  model: string;
  generated_at: string;
}

function map(dto: BackendDto): IntakeSummary {
  return {
    formId: dto.form_id,
    patientId: dto.patient_id,
    summary: dto.summary,
    bullets: dto.bullets,
    redFlags: dto.red_flags,
    followUps: dto.follow_ups,
    confidence: dto.confidence,
    model: dto.model,
    generatedAt: dto.generated_at,
  };
}

export const formsAiApi = {
  intakeSummary: async (
    formId: string,
    style: "clinical" | "patient-friendly" | "brief" = "clinical"
  ): Promise<IntakeSummary> => {
    const dto = await api.post<BackendDto>(`/ai/intake-summary/${formId}`, {
      style,
    });
    return map(dto);
  },
};
