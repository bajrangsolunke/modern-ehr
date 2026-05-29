/**
 * Typed client for the provider telehealth endpoints.
 */
import { api } from "@/lib/api-client";

export type TelehealthSessionStatus =
  | "scheduled"
  | "patient_consented"
  | "active"
  | "ended"
  | "cancelled";

export type SpeakerRole = "provider" | "patient" | "unknown";

export interface TelehealthSession {
  id: string;
  appointmentId: string;
  dailyRoomUrl: string;
  dailyRoomName: string;
  status: TelehealthSessionStatus;
  patientConsentedAt: string | null;
  providerStartedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export interface TelehealthSessionWithToken extends TelehealthSession {
  meetingToken: string;
}

export interface TranscriptSegment {
  id: string;
  sessionId: string;
  speakerRole: SpeakerRole;
  text: string;
  startOffsetMs: number;
  createdAt: string;
}

export interface TranscriptSegmentIn {
  speaker_role: SpeakerRole;
  daily_participant_id?: string | null;
  text: string;
  start_offset_ms: number;
}

export interface SoapDraft {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  sourceWordCount: number;
  model: string;
}

interface BackendSessionDto {
  id: string;
  appointment_id: string;
  daily_room_url: string;
  daily_room_name: string;
  status: TelehealthSessionStatus;
  patient_consented_at: string | null;
  provider_started_at: string | null;
  ended_at: string | null;
  created_at: string;
  meeting_token?: string;
}

interface BackendSegmentDto {
  id: string;
  session_id: string;
  speaker_role: SpeakerRole;
  text: string;
  start_offset_ms: number;
  created_at: string;
}

interface BackendDraftDto {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  source_word_count: number;
  model: string;
}

function mapSession(dto: BackendSessionDto): TelehealthSessionWithToken {
  return {
    id: dto.id,
    appointmentId: dto.appointment_id,
    dailyRoomUrl: dto.daily_room_url,
    dailyRoomName: dto.daily_room_name,
    status: dto.status,
    patientConsentedAt: dto.patient_consented_at,
    providerStartedAt: dto.provider_started_at,
    endedAt: dto.ended_at,
    createdAt: dto.created_at,
    meetingToken: dto.meeting_token ?? "",
  };
}

function mapSegment(dto: BackendSegmentDto): TranscriptSegment {
  return {
    id: dto.id,
    sessionId: dto.session_id,
    speakerRole: dto.speaker_role,
    text: dto.text,
    startOffsetMs: dto.start_offset_ms,
    createdAt: dto.created_at,
  };
}

export const telehealthApi = {
  startOrGet: async (
    appointmentId: string,
  ): Promise<TelehealthSessionWithToken> => {
    const dto = await api.post<BackendSessionDto>(
      `/telehealth/sessions/by-appointment/${appointmentId}`,
    );
    return mapSession(dto);
  },

  end: async (sessionId: string): Promise<TelehealthSession> => {
    const dto = await api.post<BackendSessionDto>(
      `/telehealth/sessions/${sessionId}/end`,
    );
    return mapSession(dto);
  },

  appendTranscript: (
    sessionId: string,
    segments: TranscriptSegmentIn[],
  ): Promise<void> =>
    api.post<void>(`/telehealth/sessions/${sessionId}/transcript`, {
      segments,
    }),

  listTranscript: async (sessionId: string): Promise<TranscriptSegment[]> => {
    const rows = await api.get<BackendSegmentDto[]>(
      `/telehealth/sessions/${sessionId}/transcript`,
    );
    return rows.map(mapSegment);
  },

  generateSoap: async (sessionId: string): Promise<SoapDraft> => {
    const dto = await api.post<BackendDraftDto>(
      `/telehealth/sessions/${sessionId}/generate-soap`,
    );
    return {
      subjective: dto.subjective,
      objective: dto.objective,
      assessment: dto.assessment,
      plan: dto.plan,
      sourceWordCount: dto.source_word_count,
      model: dto.model,
    };
  },
};
