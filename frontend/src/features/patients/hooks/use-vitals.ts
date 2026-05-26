import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vitalsApi, type VitalInput, type VitalReading } from "@/features/patients/api/vitals-api";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/lib/toast";
import {
  VITAL_METRIC_LIST,
  VITAL_METRICS,
  type VitalMetricKey,
} from "@/features/patients/lib/vital-metrics";

const vitalsKey = (patientId: string) => ["vitals", "patient", patientId] as const;

/** Demo seed — 6 readings per metric over the past 24h. */
function demoSeed(patientId: string): VitalReading[] {
  const now = Date.now();
  const out: VitalReading[] = [];
  for (const meta of VITAL_METRIC_LIST) {
    const base = meta.normal ? (meta.normal[0] + meta.normal[1]) / 2 : 50;
    for (let i = 0; i < 6; i++) {
      const t = now - i * 4 * 60 * 60 * 1000; // every 4h
      const wobble = (Math.sin(i + meta.key.length) * (base * 0.05));
      out.push({
        id: `demo-vital-${meta.key}-${i}`,
        patientId,
        metric: meta.key,
        value: Number((base + wobble).toFixed(1)),
        unit: meta.defaultUnit,
        source: "device",
        recordedAt: new Date(t).toISOString(),
      });
    }
  }
  return out;
}

function fakeVital(input: VitalInput): VitalReading {
  const meta = VITAL_METRICS[input.metric];
  return {
    id: `demo-vital-${Date.now()}`,
    patientId: input.patient_id,
    metric: input.metric,
    value: input.value,
    unit: input.unit ?? meta.defaultUnit,
    source: input.source ?? "manual",
    recordedAt: input.recorded_at ?? new Date().toISOString(),
  };
}

export function useVitals(patientId: string | undefined) {
  return useQuery({
    queryKey: vitalsKey(patientId ?? "none"),
    queryFn: () => {
      if (!patientId) return Promise.resolve<VitalReading[]>([]);
      return vitalsApi.listForPatient(
        patientId,
        { sinceHours: 24 * 7, limit: 500 },
        demoSeed(patientId)
      );
    },
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });
}

export function useCreateVital(patientId: string | undefined) {
  const qc = useQueryClient();
  const demo = useAuthStore((s) => s.demoModeActive);

  return useMutation({
    mutationFn: (input: VitalInput) =>
      demo ? Promise.resolve(fakeVital(input)) : vitalsApi.create(input),
    onSuccess: (reading) => {
      if (patientId) {
        // Optimistically prepend so the tile reflects the new reading
        // before the refetch lands.
        const prev = qc.getQueryData<VitalReading[]>(vitalsKey(patientId));
        if (prev) {
          qc.setQueryData<VitalReading[]>(vitalsKey(patientId), [reading, ...prev]);
        }
        qc.invalidateQueries({ queryKey: vitalsKey(patientId) });
      }
      const meta = VITAL_METRICS[reading.metric];
      toast.success(
        demo
          ? `${meta.label} recorded (demo only)`
          : `${meta.label} recorded`
      );
    },
    onError: (err) =>
      toast.error("Couldn't record reading", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useUpdateVital(patientId: string | undefined) {
  const qc = useQueryClient();
  const demo = useAuthStore((s) => s.demoModeActive);

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<Omit<VitalInput, "patient_id" | "metric">>;
    }) => {
      if (demo) {
        const list = qc.getQueryData<VitalReading[]>(vitalsKey(patientId ?? "none")) ?? [];
        const prior = list.find((v) => v.id === id);
        if (!prior) {
          return Promise.resolve(
            fakeVital({
              patient_id: patientId ?? "",
              metric: "heart_rate" as VitalMetricKey,
              value: input.value ?? 0,
            })
          );
        }
        return Promise.resolve({
          ...prior,
          ...(input.value !== undefined ? { value: input.value } : {}),
          ...(input.unit !== undefined ? { unit: input.unit } : {}),
          ...(input.recorded_at !== undefined
            ? { recordedAt: input.recorded_at ?? prior.recordedAt }
            : {}),
        });
      }
      return vitalsApi.update(id, input);
    },
    onSettled: () => {
      if (patientId) qc.invalidateQueries({ queryKey: vitalsKey(patientId) });
    },
    onSuccess: () => toast.success(demo ? "Saved (demo only)" : "Reading updated"),
    onError: (err) =>
      toast.error("Couldn't update reading", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useDeleteVital(patientId: string | undefined) {
  const qc = useQueryClient();
  const demo = useAuthStore((s) => s.demoModeActive);

  return useMutation({
    mutationFn: (id: string) => (demo ? Promise.resolve() : vitalsApi.remove(id)),
    onMutate: async (id) => {
      if (!patientId) return;
      await qc.cancelQueries({ queryKey: vitalsKey(patientId) });
      const prev = qc.getQueryData<VitalReading[]>(vitalsKey(patientId));
      if (prev) {
        qc.setQueryData<VitalReading[]>(
          vitalsKey(patientId),
          prev.filter((v) => v.id !== id)
        );
      }
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (patientId && ctx?.prev) qc.setQueryData(vitalsKey(patientId), ctx.prev);
      toast.error("Couldn't remove reading", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      if (patientId) qc.invalidateQueries({ queryKey: vitalsKey(patientId) });
    },
    onSuccess: () => toast.success(demo ? "Removed (demo only)" : "Reading removed"),
  });
}
