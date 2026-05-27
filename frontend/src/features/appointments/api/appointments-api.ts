import { api } from "@/lib/api-client";
import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
} from "@/types";

interface BackendAppointmentDto {
  id: string;
  patient_id: string;
  physician_id: string | null;
  type: AppointmentType;
  status: AppointmentStatus;
  starts_at: string;
  duration_minutes: number;
  room?: string | null;
  reason?: string | null;
  patient_name?: string | null;
  patient_mrn?: string | null;
  patient_avatar_url?: string | null;
  physician_name?: string | null;
}

export interface AppointmentInput {
  patient_id: string;
  physician_id?: string | null;
  type?: AppointmentType;
  status?: AppointmentStatus;
  starts_at: string;
  duration_minutes?: number;
  room?: string | null;
  reason?: string | null;
}

export interface AppointmentPatch {
  physician_id?: string | null;
  type?: AppointmentType;
  status?: AppointmentStatus;
  starts_at?: string;
  duration_minutes?: number;
  room?: string | null;
  reason?: string | null;
}

export interface AppointmentFilters {
  q?: string;
  status?: AppointmentStatus;
  type?: AppointmentType;
  physician_id?: string;
  patient_id?: string;
  start_date?: string;
  end_date?: string;
  sort_dir?: "asc" | "desc";
  limit?: number;
}

export interface AppointmentStatsDto {
  today: number;
  thisWeek: number;
  cancellationsThisWeek: number;
  noShowsThisWeek: number;
}

interface BackendStatsDto {
  today: number;
  this_week: number;
  cancellations_this_week: number;
  no_shows_this_week: number;
}

function mapAppointment(dto: BackendAppointmentDto): Appointment {
  const d = new Date(dto.starts_at);
  return {
    id: dto.id,
    patientId: dto.patient_id,
    patientName: dto.patient_name ?? "—",
    patientMrn: dto.patient_mrn ?? undefined,
    patientAvatarUrl: dto.patient_avatar_url ?? undefined,
    physicianId: dto.physician_id ?? undefined,
    physician: dto.physician_name ?? "Unassigned",
    type: dto.type,
    status: dto.status,
    startsAt: dto.starts_at,
    date: d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    duration: dto.duration_minutes,
    room: dto.room ?? undefined,
    reason: dto.reason ?? undefined,
  };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

export interface BookingSlot {
  physicianId: string;
  physicianName: string;
  startsAt: string;
  durationMinutes: number;
  load: number;
}

interface BackendSlotDto {
  physician_id: string;
  physician_name: string;
  starts_at: string;
  duration_minutes: number;
  load: number;
}

function mapSlot(dto: BackendSlotDto): BookingSlot {
  return {
    physicianId: dto.physician_id,
    physicianName: dto.physician_name,
    startsAt: dto.starts_at,
    durationMinutes: dto.duration_minutes,
    load: dto.load,
  };
}

export interface SlotQuery {
  /** YYYY-MM-DD */
  date: string;
  duration: number;
  physician_id?: string;
}

export const appointmentsApi = {
  list: async (filters: AppointmentFilters = {}): Promise<Appointment[]> => {
    const data = await api.get<BackendAppointmentDto[]>("/appointments", {
      searchParams: stripUndefined(filters) as Record<string, string | number>,
    });
    return data.map(mapAppointment);
  },

  /** Convenience for the dashboard upcoming list. */
  listUpcoming: async (limit = 8): Promise<Appointment[]> => {
    const start = new Date().toISOString();
    const data = await api.get<BackendAppointmentDto[]>("/appointments", {
      searchParams: { start_date: start, limit, sort_dir: "asc" },
    });
    return data.map(mapAppointment);
  },

  forPatient: async (patientId: string): Promise<Appointment[]> => {
    const data = await api.get<BackendAppointmentDto[]>(
      `/appointments/patient/${patientId}`
    );
    return data.map(mapAppointment);
  },

  stats: async (physicianId?: string): Promise<AppointmentStatsDto> => {
    const dto = await api.get<BackendStatsDto>("/appointments/stats", {
      searchParams: physicianId ? { physician_id: physicianId } : undefined,
    });
    return {
      today: dto.today,
      thisWeek: dto.this_week,
      cancellationsThisWeek: dto.cancellations_this_week,
      noShowsThisWeek: dto.no_shows_this_week,
    };
  },

  get: async (id: string): Promise<Appointment> => {
    const dto = await api.get<BackendAppointmentDto>(`/appointments/${id}`);
    return mapAppointment(dto);
  },

  create: async (input: AppointmentInput): Promise<Appointment> => {
    const dto = await api.post<BackendAppointmentDto>(
      "/appointments",
      stripUndefined(input)
    );
    return mapAppointment(dto);
  },

  update: async (id: string, input: AppointmentPatch): Promise<Appointment> => {
    const dto = await api.patch<BackendAppointmentDto>(
      `/appointments/${id}`,
      stripUndefined(input)
    );
    return mapAppointment(dto);
  },

  remove: (id: string): Promise<void> => api.delete(`/appointments/${id}`),

  slots: async (q: SlotQuery): Promise<BookingSlot[]> => {
    const data = await api.get<BackendSlotDto[]>("/appointments/slots", {
      searchParams: stripUndefined(q) as Record<string, string | number>,
    });
    return data.map(mapSlot);
  },
};
