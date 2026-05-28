/**
 * AI endpoints scoped to the patient chart — summary + risk + the
 * aggregator that powers the auto-on-open AI panel.
 */
import { api } from "@/lib/api-client";

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
};
