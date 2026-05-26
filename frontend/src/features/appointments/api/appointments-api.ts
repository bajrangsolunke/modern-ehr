import { api } from "@/lib/api-client";
import type { Appointment } from "@/types";

interface BackendAppointmentDto {
  id: string;
  patient_id: string;
  physician_id: string | null;
  type: Appointment["type"];
  status: Appointment["status"];
  starts_at: string;
  duration_minutes: number;
  room?: string | null;
  reason?: string | null;
}

function mapAppointment(dto: BackendAppointmentDto): Appointment {
  const date = new Date(dto.starts_at);
  return {
    id: dto.id,
    patientId: dto.patient_id,
    patientName: "—",
    type: dto.type,
    status: dto.status,
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    duration: dto.duration_minutes,
    physician: "—",
    room: dto.room ?? undefined,
  };
}

export const appointmentsApi = {
  listUpcoming: async (
    limit = 50,
    fallback?: Appointment[]
  ): Promise<Appointment[]> => {
    const data = await api.get<BackendAppointmentDto[]>("/appointments", {
      searchParams: { limit },
      demoFallback: fallback
        ? () =>
            fallback.map((a) => ({
              id: a.id,
              patient_id: a.patientId,
              physician_id: null,
              type: a.type,
              status: a.status,
              starts_at: new Date().toISOString(),
              duration_minutes: a.duration,
              room: a.room ?? null,
              reason: null,
            }))
        : undefined,
    });
    return data.map(mapAppointment);
  },
};
