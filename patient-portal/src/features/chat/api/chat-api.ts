/**
 * Patient-portal chart Q&A. Backend resolves the patient from the JWT
 * (no patient_id field on the request), so a patient can only ever
 * ask about their own chart.
 */
import { api } from "@/lib/api-client";

export interface ChatCitation {
  type?: string;
  name?: string;
  count?: number;
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

interface AskDto {
  question: string;
  answer: string;
  citations: ChatCitation[];
  model: string;
  generated_at: string;
}

export const chatApi = {
  ask: async (question: string): Promise<ChatAnswer> => {
    const dto = await api.post<AskDto>("/patient-portal/me/ask", { question });
    return {
      question: dto.question,
      answer: dto.answer,
      citations: dto.citations ?? [],
      model: dto.model,
      generatedAt: dto.generated_at,
    };
  },
};
