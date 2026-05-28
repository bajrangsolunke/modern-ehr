/**
 * Typed API client for the MedScribe AI scribe feature.
 * Maps snake_case backend DTOs to camelCase domain types.
 */
import { api } from "@/lib/api-client";
import { env } from "@/config/env";
import { STORAGE_KEYS } from "@/config/constants";

// ---------------------------------------------------------------------------
// Domain types (camelCase)
// ---------------------------------------------------------------------------

export type ScribeSessionStatus =
  | "created"
  | "recording"
  | "processing"
  | "completed"
  | "failed";

export interface ScribeSession {
  id: string;
  userId: string;
  patientId: string;
  chiefComplaint: string | null;
  status: ScribeSessionStatus;
  transcriptText: string | null;
  visitSummary: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface ScribeTranscriptChunk {
  id: string;
  sessionId: string;
  sequence: number;
  text: string;
  durationMs: number | null;
  createdAt: string;
}

export interface ScribeSoapNote {
  id: string;
  sessionId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  createdAt: string;
  editedAt: string | null;
}

export interface ScribeIcdSuggestion {
  id: string;
  sessionId: string;
  code: string;
  description: string;
  confidence: number;
  reasoning: string;
  isValidated: boolean;
  acceptedByUser: boolean;
  createdAt: string;
}

export interface ScribeSessionFull extends ScribeSession {
  transcripts: ScribeTranscriptChunk[];
  soapNote: ScribeSoapNote | null;
  icdSuggestions: ScribeIcdSuggestion[];
}

export interface ChunkUploadResult {
  sequence: number;
  text: string;
  transcriptSoFar: string;
}

// ---------------------------------------------------------------------------
// DTOs (snake_case from backend)
// ---------------------------------------------------------------------------

interface SessionDto {
  id: string;
  user_id: string;
  patient_id: string;
  chief_complaint: string | null;
  status: ScribeSessionStatus;
  transcript_text: string | null;
  visit_summary: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

interface TranscriptChunkDto {
  id: string;
  session_id: string;
  sequence: number;
  text: string;
  duration_ms: number | null;
  created_at: string;
}

interface SoapNoteDto {
  id: string;
  session_id: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  created_at: string;
  edited_at: string | null;
}

interface IcdSuggestionDto {
  id: string;
  session_id: string;
  code: string;
  description: string;
  confidence: number;
  reasoning: string;
  is_validated: boolean;
  accepted_by_user: boolean;
  created_at: string;
}

interface SessionFullDto extends SessionDto {
  transcripts: TranscriptChunkDto[];
  soap_note: SoapNoteDto | null;
  icd_suggestions: IcdSuggestionDto[];
}

interface ChunkUploadDto {
  sequence: number;
  text: string;
  transcript_so_far: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapSession(d: SessionDto): ScribeSession {
  return {
    id: d.id,
    userId: d.user_id,
    patientId: d.patient_id,
    chiefComplaint: d.chief_complaint,
    status: d.status,
    transcriptText: d.transcript_text,
    visitSummary: d.visit_summary,
    errorMessage: d.error_message,
    startedAt: d.started_at,
    completedAt: d.completed_at,
  };
}

function mapTranscriptChunk(d: TranscriptChunkDto): ScribeTranscriptChunk {
  return {
    id: d.id,
    sessionId: d.session_id,
    sequence: d.sequence,
    text: d.text,
    durationMs: d.duration_ms,
    createdAt: d.created_at,
  };
}

function mapSoapNote(d: SoapNoteDto): ScribeSoapNote {
  return {
    id: d.id,
    sessionId: d.session_id,
    subjective: d.subjective,
    objective: d.objective,
    assessment: d.assessment,
    plan: d.plan,
    createdAt: d.created_at,
    editedAt: d.edited_at,
  };
}

function mapIcdSuggestion(d: IcdSuggestionDto): ScribeIcdSuggestion {
  return {
    id: d.id,
    sessionId: d.session_id,
    code: d.code,
    description: d.description,
    confidence: d.confidence,
    reasoning: d.reasoning,
    isValidated: d.is_validated,
    acceptedByUser: d.accepted_by_user,
    createdAt: d.created_at,
  };
}

function mapSessionFull(d: SessionFullDto): ScribeSessionFull {
  return {
    ...mapSession(d),
    transcripts: d.transcripts.map(mapTranscriptChunk),
    soapNote: d.soap_note ? mapSoapNote(d.soap_note) : null,
    icdSuggestions: d.icd_suggestions.map(mapIcdSuggestion),
  };
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const scribeApi = {
  createSession: async (input: {
    patientId: string;
    chiefComplaint?: string;
  }): Promise<ScribeSession> => {
    const dto = await api.post<SessionDto>("/scribe/sessions", {
      patient_id: input.patientId,
      chief_complaint: input.chiefComplaint,
    });
    return mapSession(dto);
  },

  getSession: async (id: string): Promise<ScribeSessionFull> => {
    const dto = await api.get<SessionFullDto>(`/scribe/sessions/${id}`);
    return mapSessionFull(dto);
  },

  listForPatient: async (patientId: string): Promise<ScribeSession[]> => {
    const dtos = await api.get<SessionDto[]>(
      `/scribe/patients/${patientId}/sessions`
    );
    return dtos.map(mapSession);
  },

  uploadChunk: async (
    sessionId: string,
    file: Blob,
    sequence: number,
    durationMs?: number
  ): Promise<ChunkUploadResult> => {
    const token = localStorage.getItem(STORAGE_KEYS.accessToken);
    const form = new FormData();
    form.append("file", file, `chunk-${sequence}.webm`);
    form.append("sequence", String(sequence));
    if (durationMs !== undefined) {
      form.append("duration_ms", String(durationMs));
    }
    const res = await fetch(
      `${env.API_BASE_URL}/scribe/sessions/${sessionId}/audio-chunk`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Chunk upload failed (${res.status}): ${text}`);
    }
    const dto: ChunkUploadDto = await res.json();
    return {
      sequence: dto.sequence,
      text: dto.text,
      transcriptSoFar: dto.transcript_so_far,
    };
  },

  finalize: async (sessionId: string): Promise<ScribeSession> => {
    const dto = await api.post<SessionDto>(
      `/scribe/sessions/${sessionId}/finalize`
    );
    return mapSession(dto);
  },

  patchSoap: async (
    sessionId: string,
    input: Partial<{
      subjective: string;
      objective: string;
      assessment: string;
      plan: string;
    }>
  ): Promise<ScribeSoapNote> => {
    const dto = await api.patch<SoapNoteDto>(
      `/scribe/sessions/${sessionId}/soap`,
      input
    );
    return mapSoapNote(dto);
  },

  patchIcd: async (
    sessionId: string,
    icdId: string,
    input: Partial<{
      code: string;
      description: string;
      accepted_by_user: boolean;
    }>
  ): Promise<ScribeIcdSuggestion> => {
    const dto = await api.patch<IcdSuggestionDto>(
      `/scribe/sessions/${sessionId}/icd/${icdId}`,
      input
    );
    return mapIcdSuggestion(dto);
  },

  deleteIcd: async (sessionId: string, icdId: string): Promise<void> => {
    await api.delete<void>(`/scribe/sessions/${sessionId}/icd/${icdId}`);
  },

  patchSummary: async (
    sessionId: string,
    visitSummary: string
  ): Promise<ScribeSession> => {
    const dto = await api.patch<SessionDto>(
      `/scribe/sessions/${sessionId}/summary`,
      { visit_summary: visitSummary }
    );
    return mapSession(dto);
  },

  downloadPdf: async (sessionId: string): Promise<void> => {
    const token = localStorage.getItem(STORAGE_KEYS.accessToken);
    const res = await fetch(
      `${env.API_BASE_URL}/scribe/sessions/${sessionId}/export.pdf`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );
    if (!res.ok) throw new Error(`PDF download failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scribe-${sessionId}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  },
};
