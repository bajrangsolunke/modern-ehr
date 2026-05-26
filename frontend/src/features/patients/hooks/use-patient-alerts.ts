import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  alertsApi,
  type AlertInput,
  type PatientAlert,
} from "@/features/patients/api/alerts-api";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/lib/toast";

const alertsKey = (patientId: string) => ["alerts", "patient", patientId] as const;

function demoSeed(patientId: string): PatientAlert[] {
  const now = new Date().toISOString();
  return [
    {
      id: `demo-alert-1`,
      patientId,
      severity: "critical",
      label: "Blood thinner",
      detail: "Apixaban — paused pre-op",
      resolved: false,
      createdById: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `demo-alert-2`,
      patientId,
      severity: "warning",
      label: "DNR",
      detail: "Yes — confirmed with family",
      resolved: false,
      createdById: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `demo-alert-3`,
      patientId,
      severity: "info",
      label: "Falls risk",
      detail: "Moderate — bed alarm on",
      resolved: false,
      createdById: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function fakeAlert(input: AlertInput): PatientAlert {
  const now = new Date().toISOString();
  return {
    id: `demo-alert-${Date.now()}`,
    patientId: input.patient_id,
    severity: input.severity,
    label: input.label,
    detail: input.detail ?? null,
    resolved: false,
    createdById: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function usePatientAlerts(patientId: string | undefined) {
  return useQuery({
    queryKey: alertsKey(patientId ?? "none"),
    queryFn: () => {
      if (!patientId) return Promise.resolve<PatientAlert[]>([]);
      return alertsApi.listForPatient(patientId, undefined, demoSeed(patientId));
    },
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });
}

export function useCreateAlert(patientId: string | undefined) {
  const qc = useQueryClient();
  const demo = useAuthStore((s) => s.demoModeActive);

  return useMutation({
    mutationFn: (input: AlertInput) =>
      demo ? Promise.resolve(fakeAlert(input)) : alertsApi.create(input),
    onSuccess: () => {
      if (patientId) qc.invalidateQueries({ queryKey: alertsKey(patientId) });
      toast.success(demo ? "Alert added (demo only)" : "Alert added");
    },
    onError: (err) =>
      toast.error("Couldn't add alert", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useDeleteAlert(patientId: string | undefined) {
  const qc = useQueryClient();
  const demo = useAuthStore((s) => s.demoModeActive);

  return useMutation({
    mutationFn: (id: string) => (demo ? Promise.resolve() : alertsApi.remove(id)),
    onMutate: async (id) => {
      if (!patientId) return;
      await qc.cancelQueries({ queryKey: alertsKey(patientId) });
      const prev = qc.getQueryData<PatientAlert[]>(alertsKey(patientId));
      if (prev) {
        qc.setQueryData<PatientAlert[]>(
          alertsKey(patientId),
          prev.filter((a) => a.id !== id)
        );
      }
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (patientId && ctx?.prev) qc.setQueryData(alertsKey(patientId), ctx.prev);
      toast.error("Couldn't remove alert", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      if (patientId) qc.invalidateQueries({ queryKey: alertsKey(patientId) });
    },
    onSuccess: () => toast.success(demo ? "Removed (demo only)" : "Alert removed"),
  });
}
