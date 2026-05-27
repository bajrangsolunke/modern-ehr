import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  messagesApi,
  type ConversationFilters,
} from "../api/messages-api";
import { toast } from "@/lib/toast";

const MESSAGES_KEY = ["messages"] as const;

export function useConversations(filters: ConversationFilters) {
  return useQuery({
    queryKey: [...MESSAGES_KEY, "list", filters],
    queryFn: () => messagesApi.listConversations(filters),
    staleTime: 30_000,
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: [...MESSAGES_KEY, "byId", id],
    queryFn: () => messagesApi.getConversation(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      body,
      urgent,
    }: {
      conversationId: string;
      body: string;
      urgent?: boolean;
    }) => messagesApi.send(conversationId, { body, urgent }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MESSAGES_KEY });
    },
    onError: (err) =>
      toast.error("Couldn't send message", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useComposeBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      audience: "patient" | "clinician";
      recipientIds: string[];
      body: string;
      urgent: boolean;
    }) => {
      const results = [];
      // One conversation per recipient when broadcasting to patients —
      // matches the in-memory store behavior and how the UI presents
      // them in the list.
      if (input.audience === "patient") {
        for (const patientId of input.recipientIds) {
          results.push(
            await messagesApi.createPatientConversation({
              patientId,
              body: input.body,
              urgent: input.urgent,
            })
          );
        }
      } else {
        // Single clinician thread containing every selected user.
        results.push(
          await messagesApi.createClinicianConversation({
            userIds: input.recipientIds,
            body: input.body,
            urgent: input.urgent,
          })
        );
      }
      return results;
    },
    onSuccess: (results) => {
      qc.invalidateQueries({ queryKey: MESSAGES_KEY });
      toast.success(
        `Message sent to ${results.length} recipient${
          results.length === 1 ? "" : "s"
        }`
      );
    },
    onError: (err) =>
      toast.error("Couldn't send message", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => messagesApi.markRead(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: [...MESSAGES_KEY, "list"] });
      qc.invalidateQueries({ queryKey: [...MESSAGES_KEY, "byId", id] });
    },
  });
}

export const messagesQueryKey = MESSAGES_KEY;
