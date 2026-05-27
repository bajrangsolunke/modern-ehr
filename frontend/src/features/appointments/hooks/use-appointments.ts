import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  appointmentsApi,
  type AppointmentFilters,
  type AppointmentInput,
  type AppointmentPatch,
} from "@/features/appointments/api/appointments-api";
import { QUERY_KEYS } from "@/config/constants";
import { toast } from "@/lib/toast";
import type { Appointment, AppointmentStatus } from "@/types";

const APPT_KEY = ["appointments"] as const;

export function useAppointments(filters: AppointmentFilters = {}) {
  return useQuery({
    queryKey: [...APPT_KEY, "list", filters],
    queryFn: () => appointmentsApi.list(filters),
    staleTime: 30_000,
  });
}

export function useAppointment(id: string | undefined) {
  return useQuery({
    queryKey: [...APPT_KEY, "byId", id],
    queryFn: () => appointmentsApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useAppointmentStats(physicianId?: string) {
  return useQuery({
    queryKey: [...APPT_KEY, "stats", physicianId ?? "all"],
    queryFn: () => appointmentsApi.stats(physicianId),
    staleTime: 30_000,
  });
}

export function usePatientAppointments(patientId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.appointments.forPatient(patientId ?? "none"),
    queryFn: () => appointmentsApi.forPatient(patientId as string),
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AppointmentInput) => appointmentsApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: APPT_KEY });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.appointments.all });
      toast.success("Appointment scheduled");
    },
    onError: (err) =>
      toast.error("Couldn't schedule appointment", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AppointmentPatch }) =>
      appointmentsApi.update(id, input),
    onMutate: async ({ id, input }) => {
      // Optimistic status / time edits feel snappier when the row
      // updates immediately. Snapshot every list query so we can roll
      // back on error.
      await qc.cancelQueries({ queryKey: APPT_KEY });
      const snapshots: Array<[readonly unknown[], Appointment[] | undefined]> = [];
      const queries = qc.getQueriesData<Appointment[]>({ queryKey: APPT_KEY });
      for (const [key, list] of queries) {
        snapshots.push([key, list]);
        if (!Array.isArray(list)) continue;
        const next = list.map((a) =>
          a.id === id ? { ...a, ...localPatch(a, input) } : a
        );
        qc.setQueryData(key, next);
      }
      return { snapshots };
    },
    onError: (err, _vars, ctx) => {
      for (const [key, prev] of ctx?.snapshots ?? []) {
        qc.setQueryData(key, prev);
      }
      toast.error("Couldn't update appointment", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: APPT_KEY });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.appointments.all });
    },
    onSuccess: () => toast.success("Appointment updated"),
  });
}

/** Convenience: row-menu "Confirm / Complete / Cancel / No-show" actions. */
export function useSetAppointmentStatus() {
  const update = useUpdateAppointment();
  return {
    isPending: update.isPending,
    mutate: (id: string, status: AppointmentStatus) =>
      update.mutate({ id, input: { status } }),
  };
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => appointmentsApi.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: APPT_KEY });
      const snapshots: Array<[readonly unknown[], Appointment[] | undefined]> = [];
      const queries = qc.getQueriesData<Appointment[]>({ queryKey: APPT_KEY });
      for (const [key, list] of queries) {
        snapshots.push([key, list]);
        if (!Array.isArray(list)) continue;
        qc.setQueryData(
          key,
          list.filter((a) => a.id !== id)
        );
      }
      return { snapshots };
    },
    onError: (err, _id, ctx) => {
      for (const [key, prev] of ctx?.snapshots ?? []) {
        qc.setQueryData(key, prev);
      }
      toast.error("Couldn't remove appointment", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: APPT_KEY }),
    onSuccess: () => toast.success("Appointment removed"),
  });
}

function localPatch(a: Appointment, input: AppointmentPatch): Partial<Appointment> {
  const patch: Partial<Appointment> = {};
  if (input.status) patch.status = input.status;
  if (input.type) patch.type = input.type;
  if (input.room !== undefined) patch.room = input.room ?? undefined;
  if (input.reason !== undefined) patch.reason = input.reason ?? undefined;
  if (input.duration_minutes !== undefined)
    patch.duration = input.duration_minutes;
  if (input.starts_at) {
    const d = new Date(input.starts_at);
    patch.startsAt = input.starts_at;
    patch.date = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    patch.time = d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  void a;
  return patch;
}
