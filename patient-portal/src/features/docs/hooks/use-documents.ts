import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { docsApi } from "@/features/docs/api/docs-api";
import { toast } from "@/lib/toast";

export function useDocuments() {
  return useQuery({
    queryKey: ["documents", "me"],
    queryFn: docsApi.list,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, category }: { file: File; category: string }) =>
      docsApi.upload(file, category),
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ["documents", "me"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "me"] });
      toast.success("Document uploaded", { description: doc.name });
    },
    onError: (err) =>
      toast.error("Couldn't upload document", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
