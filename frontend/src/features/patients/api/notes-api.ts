import { api } from "@/lib/api-client";
import { stripUndefined } from "@/lib/api-utils";
import type { SoapNote } from "@/types";

interface BackendNoteDto {
  id: string;
  patient_id: string;
  author_id?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  ai_summary?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface NoteInput {
  patient_id: string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
}

function mapNote(dto: BackendNoteDto): SoapNote {
  return {
    id: dto.id,
    patientId: dto.patient_id,
    authorId: dto.author_id ?? undefined,
    date: dto.created_at,
    author: "—", // backend doesn't return display name; future endpoint can join
    subjective: dto.subjective ?? "",
    objective: dto.objective ?? "",
    assessment: dto.assessment ?? "",
    plan: dto.plan ?? "",
    aiSummary: dto.ai_summary ?? undefined,
    version: dto.version,
    updatedAt: dto.updated_at,
  };
}

function noteToBackendDto(n: SoapNote): BackendNoteDto {
  return {
    id: n.id,
    patient_id: n.patientId ?? "",
    author_id: n.authorId ?? null,
    subjective: n.subjective || null,
    objective: n.objective || null,
    assessment: n.assessment || null,
    plan: n.plan || null,
    ai_summary: n.aiSummary ?? null,
    version: n.version,
    created_at: n.date,
    updated_at: n.updatedAt ?? n.date,
  };
}

export const notesApi = {
  listForPatient: async (
    patientId: string,
    fallback?: SoapNote[]
  ): Promise<SoapNote[]> => {
    const data = await api.get<BackendNoteDto[]>(`/notes/patient/${patientId}`, {
      demoFallback: fallback ? () => fallback.map(noteToBackendDto) : undefined,
    });
    return data.map(mapNote);
  },

  create: async (input: NoteInput): Promise<SoapNote> => {
    const dto = await api.post<BackendNoteDto>("/notes", stripUndefined(input));
    return mapNote(dto);
  },

  update: async (
    id: string,
    input: Partial<Omit<NoteInput, "patient_id">>
  ): Promise<SoapNote> => {
    const dto = await api.patch<BackendNoteDto>(`/notes/${id}`, stripUndefined(input));
    return mapNote(dto);
  },

  remove: (id: string): Promise<void> => api.delete(`/notes/${id}`),
};
