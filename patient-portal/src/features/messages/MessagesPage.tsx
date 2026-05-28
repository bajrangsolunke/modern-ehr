import { useEffect, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { ErrorBanner } from "@/components/ui/error-banner";
import { UserAvatar } from "@/components/ui/avatar";
import { api } from "@/lib/api-client";
import { messagesApi } from "./api/messages-api";
import {
  useConversation,
  useConversations,
  useSendMessage,
} from "./hooks/use-messages";
import { useTypingStore, selectAnyoneTyping } from "./stores/typing-store";
import { ConversationList } from "./components/ConversationList";
import { MessageThread } from "./components/MessageThread";
import { MessageComposer } from "./components/MessageComposer";

export function MessagesPage() {
  const list = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const detail = useConversation(activeId);
  const send = useSendMessage(activeId);

  // Auto-select the first conversation once the list loads.
  useEffect(() => {
    if (!activeId && list.data && list.data.items.length > 0) {
      setActiveId(list.data.items[0].id);
    }
  }, [list.data, activeId]);

  // Mark the thread read whenever it opens or receives a new message.
  // Failures are silent — the worst case is a stale watermark on the
  // provider side until the next reload.
  useEffect(() => {
    if (!activeId || !detail.data) return;
    messagesApi.markRead(activeId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, detail.data?.messages.length]);

  // Staff-side typing indicator. The selector returns the latest
  // typing state for the active conversation; the WS hook (mounted in
  // the Topbar) keeps it fresh.
  const staffTyping = useTypingStore((s) => selectAnyoneTyping(s, activeId));

  const handleSuggest = activeId
    ? async (): Promise<string | null> => {
        const res = await api.post<{ suggestions: string[] }>(
          `/patient-portal/me/conversations/${activeId}/ai-suggest`
        );
        return res.suggestions?.[0] ?? null;
      }
    : undefined;

  const handleTyping = activeId
    ? () => {
        messagesApi.pingTyping(activeId).catch(() => {});
      }
    : undefined;

  return (
    <>
      <PageHeader
        title="Communication"
        subtitle="Secure messages with your care team."
      />

      {list.isLoading && (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}

      {list.isError && !list.isLoading && (
        <ErrorBanner
          title="Couldn't load conversations"
          message={list.error instanceof Error ? list.error.message : "Please try again."}
          onRetry={() => list.refetch()}
          retrying={list.isFetching}
        />
      )}

      {!list.isLoading && !list.isError && list.data && (
        <>
          {list.data.items.length === 0 ? (
            <Empty
              icon={<MessageSquare className="size-5" />}
              title="No conversations yet"
              description="When your care team starts a conversation with you, it'll appear here."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 lg:gap-5">
              <Card className="p-3 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto">
                <ConversationList
                  items={list.data.items}
                  activeId={activeId}
                  onSelect={setActiveId}
                />
              </Card>

              <Card className="flex flex-col lg:h-[calc(100vh-220px)] overflow-hidden">
                {!activeId || !detail.data ? (
                  <div className="grid place-items-center flex-1 py-12">
                    {detail.isLoading ? (
                      <Loader2 className="size-6 animate-spin text-primary" />
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Select a conversation
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <ChatHeader
                      title={
                        detail.data.participants
                          .filter((p) => p.trim().length > 0)
                          .join(", ") ||
                        detail.data.title ||
                        "Care team"
                      }
                      messageCount={detail.data.messages.length}
                    />
                    <div className="flex-1 overflow-y-auto px-5 py-4 bg-secondary/30">
                      <MessageThread
                        messages={detail.data.messages}
                        staffLastReadAt={detail.data.staff_last_read_at}
                        staffTyping={staffTyping}
                      />
                    </div>
                    <MessageComposer
                      pending={send.isPending}
                      onSuggest={handleSuggest}
                      onSend={(body) => send.mutateAsync(body).then(() => undefined)}
                      onTyping={handleTyping}
                    />
                  </>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );
}

/**
 * Chat header above the thread — mirrors the provider portal's
 * `ParticipantHeader`. Big avatar on the left, sender name on top,
 * message count subtitle below. The patient-portal `ConversationDetail`
 * only exposes a `participants: string[]` (display names), so we use
 * the first name to seed the avatar's initial colour.
 */
function ChatHeader({
  title,
  messageCount,
}: {
  title: string;
  messageCount: number;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-white">
      <UserAvatar name={title} size="lg" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-bold truncate">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {messageCount} {messageCount === 1 ? "message" : "messages"}
        </p>
      </div>
    </div>
  );
}
