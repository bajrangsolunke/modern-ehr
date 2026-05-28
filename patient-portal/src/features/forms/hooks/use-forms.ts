import { useQuery } from "@tanstack/react-query";
import { formsApi } from "@/features/forms/api/forms-api";

export function useForms() {
  return useQuery({
    queryKey: ["forms", "me", "list"],
    queryFn: formsApi.list,
  });
}
