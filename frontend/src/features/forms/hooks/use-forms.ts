import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  formsApi,
  type FormRequestFilters,
  type FormType,
} from "../api/forms-api";
import { toast } from "@/lib/toast";

const FORMS_KEY = ["form-requests"] as const;

export function useFormRequests(filters: FormRequestFilters) {
  return useQuery({
    queryKey: [...FORMS_KEY, "list", filters],
    queryFn: () => formsApi.list(filters),
    staleTime: 30_000,
  });
}

export function useFormRequest(id: string | undefined) {
  return useQuery({
    queryKey: [...FORMS_KEY, "byId", id],
    queryFn: () => formsApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useRequestForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      patient_id: string;
      form_type: FormType;
      notes?: string | null;
      due_date?: string | null;
    }) => formsApi.request(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FORMS_KEY });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Form requested");
    },
    onError: (err) =>
      toast.error("Couldn't request form", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useSubmitForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Record<string, unknown>;
    }) => formsApi.submit(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FORMS_KEY });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Form submitted for review");
    },
    onError: (err) =>
      toast.error("Couldn't submit form", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useReviewForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      review_notes,
    }: {
      id: string;
      decision: "completed" | "denied";
      review_notes?: string | null;
    }) => formsApi.review(id, { decision, review_notes }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: FORMS_KEY });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(
        vars.decision === "completed" ? "Form approved" : "Form denied"
      );
    },
    onError: (err) =>
      toast.error("Couldn't update form", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useDeleteFormRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => formsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FORMS_KEY });
      toast.success("Form request removed");
    },
    onError: (err) =>
      toast.error("Couldn't remove form", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
