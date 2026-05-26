import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notesApi, type NoteInput } from "@/features/patients/api/notes-api";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/lib/toast";
import { soapNotes as mockNotes } from "@/mocks";
import type { SoapNote } from "@/types";

const notesKey = (patientId: string) => ["notes", "patient", patientId] as const;

export function useNotes(patientId: string | undefined) {
  return useQuery({
    queryKey: notesKey(patientId ?? "none"),
    queryFn: () => {
      if (!patientId) return Promise.resolve([]);
      return notesApi.listForPatient(patientId, mockNotes);
    },
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });
}

function fakeNote(input: NoteInput, version = 1): SoapNote {
  const now = new Date().toISOString();
  return {
    id: `demo-note-${Date.now()}`,
    patientId: input.patient_id,
    authorId: undefined,
    date: now,
    author: "You",
    subjective: input.subjective ?? "",
    objective: input.objective ?? "",
    assessment: input.assessment ?? "",
    plan: input.plan ?? "",
    version,
    updatedAt: now,
  };
}

export function useCreateNote(patientId: string | undefined) {
  const qc = useQueryClient();
  const demo = useAuthStore((s) => s.demoModeActive);

  return useMutation({
    mutationFn: (input: NoteInput) =>
      demo ? Promise.resolve(fakeNote(input)) : notesApi.create(input),
    onSuccess: () => {
      if (patientId) qc.invalidateQueries({ queryKey: notesKey(patientId) });
      toast.success(demo ? "Note added (demo only)" : "SOAP note saved");
    },
    onError: (err) =>
      toast.error("Couldn't save SOAP note", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useUpdateNote(patientId: string | undefined) {
  const qc = useQueryClient();
  const demo = useAuthStore((s) => s.demoModeActive);

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<Omit<NoteInput, "patient_id">>;
    }) => {
      if (demo) {
        const list = qc.getQueryData<SoapNote[]>(notesKey(patientId ?? "none")) ?? [];
        const prior = list.find((n) => n.id === id);
        if (!prior) {
          return Promise.resolve(
            fakeNote({ patient_id: patientId ?? "", ...input }, 1)
          );
        }
        return Promise.resolve({
          ...prior,
          ...(input.subjective !== undefined ? { subjective: input.subjective ?? "" } : {}),
          ...(input.objective !== undefined ? { objective: input.objective ?? "" } : {}),
          ...(input.assessment !== undefined ? { assessment: input.assessment ?? "" } : {}),
          ...(input.plan !== undefined ? { plan: input.plan ?? "" } : {}),
          version: prior.version + 1,
          updatedAt: new Date().toISOString(),
        });
      }
      return notesApi.update(id, input);
    },
    onSettled: () => {
      if (patientId) qc.invalidateQueries({ queryKey: notesKey(patientId) });
    },
    onSuccess: () => toast.success(demo ? "Saved (demo only)" : "SOAP note saved"),
    onError: (err) =>
      toast.error("Couldn't save SOAP note", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useDeleteNote(patientId: string | undefined) {
  const qc = useQueryClient();
  const demo = useAuthStore((s) => s.demoModeActive);

  return useMutation({
    mutationFn: (id: string) => (demo ? Promise.resolve() : notesApi.remove(id)),
    onMutate: async (id) => {
      if (!patientId) return;
      await qc.cancelQueries({ queryKey: notesKey(patientId) });
      const prev = qc.getQueryData<SoapNote[]>(notesKey(patientId));
      if (prev) {
        qc.setQueryData<SoapNote[]>(
          notesKey(patientId),
          prev.filter((n) => n.id !== id)
        );
      }
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (patientId && ctx?.prev) qc.setQueryData(notesKey(patientId), ctx.prev);
      toast.error("Couldn't remove SOAP note", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      if (patientId) qc.invalidateQueries({ queryKey: notesKey(patientId) });
    },
    onSuccess: () => toast.success(demo ? "Removed (demo only)" : "SOAP note removed"),
  });
}
