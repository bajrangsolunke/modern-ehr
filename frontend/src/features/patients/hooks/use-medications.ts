import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { medicationsApi, type MedicationInput } from "@/features/patients/api/medications-api";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/lib/toast";
import { medications as mockMeds } from "@/mocks";
import type { Medication, MedicationStatus } from "@/types";

const medsKey = (patientId: string) => ["medications", "patient", patientId] as const;

export function useMedications(patientId: string | undefined) {
  return useQuery({
    queryKey: medsKey(patientId ?? "none"),
    queryFn: () => {
      if (!patientId) return Promise.resolve([]);
      return medicationsApi.listForPatient(patientId, mockMeds);
    },
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });
}

function fakeMed(input: MedicationInput): Medication {
  return {
    id: `demo-med-${Date.now()}`,
    patientId: input.patient_id,
    name: input.name,
    dose: input.dose,
    frequency: input.frequency,
    route: input.route ?? "oral",
    rxnorm: input.rxnorm ?? undefined,
    startDate: input.start_date ?? "",
    endDate: input.end_date ?? undefined,
    status: input.status ?? "active",
    prescriber: input.prescriber ?? "",
  };
}

export function useCreateMedication(patientId: string | undefined) {
  const qc = useQueryClient();
  const demo = useAuthStore((s) => s.demoModeActive);

  return useMutation({
    mutationFn: (input: MedicationInput) =>
      demo ? Promise.resolve(fakeMed(input)) : medicationsApi.create(input),
    onSuccess: () => {
      if (patientId) qc.invalidateQueries({ queryKey: medsKey(patientId) });
      toast.success(demo ? "Medication added (demo only)" : "Medication added");
    },
    onError: (err) =>
      toast.error("Couldn't add medication", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useUpdateMedication(patientId: string | undefined) {
  const qc = useQueryClient();
  const demo = useAuthStore((s) => s.demoModeActive);

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<Omit<MedicationInput, "patient_id">>;
    }) => {
      if (demo) {
        const list = qc.getQueryData<Medication[]>(medsKey(patientId ?? "none")) ?? [];
        const prior = list.find((m) => m.id === id);
        return Promise.resolve({
          ...(prior ?? fakeMed({
            patient_id: patientId ?? "",
            name: "",
            dose: "",
            frequency: "",
          })),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.dose !== undefined ? { dose: input.dose } : {}),
          ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
          ...(input.route !== undefined ? { route: input.route } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.prescriber !== undefined ? { prescriber: input.prescriber ?? "" } : {}),
          ...(input.start_date !== undefined ? { startDate: input.start_date ?? "" } : {}),
        } as Medication);
      }
      return medicationsApi.update(id, input);
    },
    onMutate: async ({ id, input }) => {
      if (!patientId) return;
      await qc.cancelQueries({ queryKey: medsKey(patientId) });
      const prev = qc.getQueryData<Medication[]>(medsKey(patientId));
      if (prev) {
        qc.setQueryData<Medication[]>(
          medsKey(patientId),
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  ...(input.name !== undefined ? { name: input.name } : {}),
                  ...(input.dose !== undefined ? { dose: input.dose } : {}),
                  ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
                  ...(input.route !== undefined ? { route: input.route } : {}),
                  ...(input.status !== undefined ? { status: input.status } : {}),
                  ...(input.prescriber !== undefined
                    ? { prescriber: input.prescriber ?? "" }
                    : {}),
                  ...(input.start_date !== undefined
                    ? { startDate: input.start_date ?? "" }
                    : {}),
                }
              : m
          )
        );
      }
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (patientId && ctx?.prev) qc.setQueryData(medsKey(patientId), ctx.prev);
      toast.error("Couldn't save medication", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      if (patientId) qc.invalidateQueries({ queryKey: medsKey(patientId) });
    },
    onSuccess: () => toast.success(demo ? "Saved (demo only)" : "Medication saved"),
  });
}

export function useDeleteMedication(patientId: string | undefined) {
  const qc = useQueryClient();
  const demo = useAuthStore((s) => s.demoModeActive);

  return useMutation({
    mutationFn: (id: string) =>
      demo ? Promise.resolve() : medicationsApi.remove(id),
    onMutate: async (id) => {
      if (!patientId) return;
      await qc.cancelQueries({ queryKey: medsKey(patientId) });
      const prev = qc.getQueryData<Medication[]>(medsKey(patientId));
      if (prev) {
        qc.setQueryData<Medication[]>(
          medsKey(patientId),
          prev.filter((m) => m.id !== id)
        );
      }
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (patientId && ctx?.prev) qc.setQueryData(medsKey(patientId), ctx.prev);
      toast.error("Couldn't remove medication", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      if (patientId) qc.invalidateQueries({ queryKey: medsKey(patientId) });
    },
    onSuccess: () => toast.success(demo ? "Removed (demo only)" : "Medication removed"),
  });
}

/** Convenience helper used by per-row "Pause" / "Discontinue" / "Resume" actions */
export function useSetMedicationStatus(patientId: string | undefined) {
  const update = useUpdateMedication(patientId);
  return {
    isPending: update.isPending,
    mutate: (id: string, status: MedicationStatus) =>
      update.mutate({ id, input: { status } }),
  };
}
