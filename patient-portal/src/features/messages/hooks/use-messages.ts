import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { messagesApi } from "@/features/messages/api/messages-api";
import { toast } from "@/lib/toast";

export function useConversations() {
  return useQuery({
    queryKey: ["conversations", "me"],
    queryFn: messagesApi.listConversations,
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ["conversations", "me", id],
    queryFn: () => messagesApi.getConversation(id as string),
    enabled: Boolean(id),
    refetchInterval: 10_000,
  });
}

export function useSendMessage(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => {
      if (!conversationId) throw new Error("No conversation selected");
      return messagesApi.sendMessage(conversationId, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations", "me", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations", "me"] });
    },
    onError: (err) =>
      toast.error("Couldn't send message", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
