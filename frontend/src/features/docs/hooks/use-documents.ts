import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  docsApi,
  type Document,
  type DocumentFilters,
} from "@/features/docs/api/docs-api";
import { toast } from "@/lib/toast";

const DOCS_KEY = ["documents"] as const;

export function useDocuments(filters: DocumentFilters) {
  return useQuery({
    queryKey: [...DOCS_KEY, "list", filters],
    queryFn: () => docsApi.list(filters),
    staleTime: 30_000,
  });
}

export function usePatientDocuments(patientId: string | undefined) {
  return useQuery({
    queryKey: [...DOCS_KEY, "patient", patientId],
    queryFn: () => docsApi.forPatient(patientId as string),
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: [...DOCS_KEY, "byId", id],
    queryFn: () => docsApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useDocumentPreview(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...DOCS_KEY, "preview", id],
    queryFn: () => docsApi.preview(id as string),
    enabled: enabled && Boolean(id),
    staleTime: 60_000,
    retry: false,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: docsApi.upload,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DOCS_KEY });
      toast.success("Document uploaded");
    },
    onError: (err) =>
      toast.error("Couldn't upload document", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => docsApi.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: DOCS_KEY });
      const snapshots: Array<[readonly unknown[], unknown]> = [];
      // Best-effort optimistic remove from any cached list.
      const lists = qc.getQueriesData<{ items: Document[] }>({
        queryKey: [...DOCS_KEY, "list"],
      });
      for (const [key, page] of lists) {
        snapshots.push([key, page]);
        if (!page) continue;
        qc.setQueryData(key, {
          ...page,
          items: page.items.filter((d) => d.id !== id),
        });
      }
      return { snapshots };
    },
    onError: (err, _id, ctx) => {
      for (const [key, prev] of ctx?.snapshots ?? []) {
        qc.setQueryData(key, prev);
      }
      toast.error("Couldn't remove document", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: DOCS_KEY }),
    onSuccess: () => toast.success("Document removed"),
  });
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: (doc: Document) => docsApi.download(doc),
    onError: (err) =>
      toast.error("Couldn't download", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
