/**
 * AI endpoints scoped to the patient chart — summary + risk + the
 * aggregator that powers the auto-on-open AI panel.
 * Also contains ICD-suggest (Feature B) and patient Q&A ask (Feature C).
 */
import { api } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Feature B — ICD-suggest types
// ---------------------------------------------------------------------------

export interface IcdSuggestion {
  code: string;
  description: string;
  confidence: number;
  reasoning: string | null;
  isValidated: boolean;
}

export interface IcdSuggestResponse {
  suggestions: IcdSuggestion[];
  model: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Feature C — Patient Q&A chat types
// ---------------------------------------------------------------------------

export interface ChatCitation {
  type?: string;
  ref_id?: string;
  snippet?: string;
  [k: string]: unknown;
}

export interface ChatAnswer {
  question: string;
  answer: string;
  citations: ChatCitation[];
  model: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface PatientChartSummary {
  patientId: string;
  summary: string;
  bullets: string[];
  confidence: number;
  model: string;
  generatedAt: string;
  cached: boolean;
}

export interface PatientRisk {
  patientId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  drivers: string[];
  recommendedActions: string[];
  model: string;
  generatedAt: string;
  cached: boolean;
}

export interface PatientChartContext {
  summary: PatientChartSummary;
  risk: PatientRisk;
  aiAlertsCount: number;
}

interface SummaryDto {
  patient_id: string;
  summary: string;
  bullets: string[];
  confidence: number;
  model: string;
  generated_at: string;
  cached: boolean;
}

interface RiskDto {
  patient_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  drivers: string[];
  recommended_actions: string[];
  model: string;
  generated_at: string;
  cached: boolean;
}

interface ChartContextDto {
  summary: SummaryDto;
  risk: RiskDto;
  ai_alerts_count: number;
}

function mapSummary(d: SummaryDto): PatientChartSummary {
  return {
    patientId: d.patient_id,
    summary: d.summary,
    bullets: d.bullets,
    confidence: d.confidence,
    model: d.model,
    generatedAt: d.generated_at,
    cached: d.cached,
  };
}

function mapRisk(d: RiskDto): PatientRisk {
  return {
    patientId: d.patient_id,
    riskScore: d.risk_score,
    riskLevel: d.risk_level,
    drivers: d.drivers,
    recommendedActions: d.recommended_actions,
    model: d.model,
    generatedAt: d.generated_at,
    cached: d.cached,
  };
}

export interface SoapDraft {
  formId: string;
  patientId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  confidence: number;
  model: string;
  generatedAt: string;
}

interface SoapDraftDto {
  form_id: string;
  patient_id: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  confidence: number;
  model: string;
  generated_at: string;
}

function mapSoapDraft(d: SoapDraftDto): SoapDraft {
  return {
    formId: d.form_id,
    patientId: d.patient_id,
    subjective: d.subjective,
    objective: d.objective,
    assessment: d.assessment,
    plan: d.plan,
    confidence: d.confidence,
    model: d.model,
    generatedAt: d.generated_at,
  };
}

export const patientsAiApi = {
  getChartContext: async (
    patientId: string,
    opts?: { force?: boolean }
  ): Promise<PatientChartContext> => {
    const dto = await api.get<ChartContextDto>(
      `/ai/chart-context/${patientId}`,
      {
        searchParams: opts?.force ? { force: "true" } : undefined,
      }
    );
    return {
      summary: mapSummary(dto.summary),
      risk: mapRisk(dto.risk),
      aiAlertsCount: dto.ai_alerts_count,
    };
  },

  regenerateSummary: async (patientId: string): Promise<PatientChartSummary> => {
    const dto = await api.post<SummaryDto>("/ai/summary", {
      patient_id: patientId,
      style: "clinical",
    }, {
      searchParams: { force: "true" },
    });
    return mapSummary(dto);
  },

  regenerateRisk: async (patientId: string): Promise<PatientRisk> => {
    const dto = await api.get<RiskDto>(`/ai/risk/${patientId}`, {
      searchParams: { force: "true" },
    });
    return mapRisk(dto);
  },

  soapFromIntake: async (patientId: string): Promise<SoapDraft> => {
    const dto = await api.post<SoapDraftDto>(
      `/ai/soap-from-intake/${patientId}`
    );
    return mapSoapDraft(dto);
  },

  /** Turn an encounter transcript (dictation or paste) into a SOAP
   *  draft. The backend hits the LLM with a scribe prompt and returns
   *  all four sections. The provider edits before saving. */
  scribeFromTranscript: async (
    transcript: string,
    patientId: string
  ): Promise<{
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  }> => {
    const res = await api.post<{
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
    }>("/ai/scribe", { transcript, patient_id: patientId });
    return {
      subjective: res.subjective ?? "",
      objective: res.objective ?? "",
      assessment: res.assessment ?? "",
      plan: res.plan ?? "",
    };
  },

  /** Feature B — suggest ICD-10 codes from free-form SOAP text. */
  suggestIcd: async (input: {
    text: string;
    patientId?: string;
    noteId?: string;
  }): Promise<IcdSuggestResponse> => {
    const dto = await api.post<{
      suggestions: Array<{
        code: string;
        description: string;
        confidence: number;
        reasoning: string | null;
        is_validated: boolean;
      }>;
      model: string;
      generated_at: string;
    }>("/ai/icd-suggest", {
      text: input.text,
      patient_id: input.patientId ?? null,
      note_id: input.noteId ?? null,
    });
    return {
      suggestions: dto.suggestions.map((s) => ({
        code: s.code,
        description: s.description,
        confidence: s.confidence,
        reasoning: s.reasoning,
        isValidated: s.is_validated,
      })),
      model: dto.model,
      generatedAt: dto.generated_at,
    };
  },

  /** Feature C — patient chart Q&A via RAG. */
  ask: async (input: {
    question: string;
    patientId?: string;
    topK?: number;
  }): Promise<ChatAnswer> => {
    const dto = await api.post<{
      question: string;
      answer: string;
      citations: ChatCitation[];
      model: string;
      generated_at: string;
    }>("/ai/ask", {
      question: input.question,
      patient_id: input.patientId ?? null,
      top_k: input.topK ?? 4,
    });
    return {
      question: dto.question,
      answer: dto.answer,
      citations: dto.citations ?? [],
      model: dto.model,
      generatedAt: dto.generated_at,
    };
  },
};
