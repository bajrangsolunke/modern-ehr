import { useQuery } from "@tanstack/react-query";
import { docsApi } from "@/features/docs/api/docs-api";

export function useDocuments() {
  return useQuery({
    queryKey: ["documents", "me"],
    queryFn: docsApi.list,
  });
}
