import { api } from "@/lib/api-client";

/** 0 = Monday, 6 = Sunday — matches the backend. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface AvailabilitySlot {
  id: string;
  userId: string;
  dayOfWeek: DayOfWeek;
  /** "HH:MM" 24-hour. */
  startTime: string;
  /** "HH:MM" 24-hour. */
  endTime: string;
  isActive: boolean;
  note: string | null;
}

interface BackendSlot {
  id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  note?: string | null;
}

export interface AvailabilityInput {
  day_of_week: DayOfWeek;
  /** Pass as "HH:MM:SS" or "HH:MM" — backend accepts ISO time. */
  start_time: string;
  end_time: string;
  is_active?: boolean;
  note?: string | null;
}

/** Trims the trailing ":SS" backends often emit so the UI only deals in HH:MM. */
function trim(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function mapSlot(dto: BackendSlot): AvailabilitySlot {
  return {
    id: dto.id,
    userId: dto.user_id,
    dayOfWeek: dto.day_of_week as DayOfWeek,
    startTime: trim(dto.start_time),
    endTime: trim(dto.end_time),
    isActive: dto.is_active,
    note: dto.note ?? null,
  };
}

export const availabilityApi = {
  forMe: async (): Promise<AvailabilitySlot[]> => {
    const data = await api.get<BackendSlot[]>("/availability/me");
    return data.map(mapSlot);
  },
  forUser: async (userId: string): Promise<AvailabilitySlot[]> => {
    const data = await api.get<BackendSlot[]>(`/availability/user/${userId}`);
    return data.map(mapSlot);
  },
  create: async (
    userId: string,
    input: AvailabilityInput
  ): Promise<AvailabilitySlot> => {
    // "me" is a logical id used by the editor when a user manages
    // their own schedule. The backend exposes a matching POST /me
    // endpoint that scopes the create to the signed-in user.
    const path =
      userId === "me" ? "/availability/me" : `/availability/user/${userId}`;
    const dto = await api.post<BackendSlot>(path, input);
    return mapSlot(dto);
  },
  update: async (
    id: string,
    input: Partial<AvailabilityInput>
  ): Promise<AvailabilitySlot> => {
    const dto = await api.patch<BackendSlot>(`/availability/${id}`, input);
    return mapSlot(dto);
  },
  remove: (id: string): Promise<void> => api.delete(`/availability/${id}`),
};
