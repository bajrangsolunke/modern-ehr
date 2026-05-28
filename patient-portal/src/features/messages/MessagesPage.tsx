import { useEffect, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { ErrorBanner } from "@/components/ui/error-banner";
import {
  useConversation,
  useConversations,
  useSendMessage,
} from "./hooks/use-messages";
import { ConversationList } from "./components/ConversationList";
import { MessageThread } from "./components/MessageThread";
import { MessageComposer } from "./components/MessageComposer";
import { AiSuggestions } from "./components/AiSuggestions";

export function MessagesPage() {
  const list = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const detail = useConversation(activeId);
  const send = useSendMessage(activeId);
  const [composerSeed, setComposerSeed] = useState<string | undefined>();

  // Auto-select the first conversation once the list loads.
  useEffect(() => {
    if (!activeId && list.data && list.data.items.length > 0) {
      setActiveId(list.data.items[0].id);
    }
  }, [list.data, activeId]);

  // Reset the composer seed when switching threads — old suggestion
  // shouldn't haunt a new conversation.
  useEffect(() => {
    setComposerSeed(undefined);
  }, [activeId]);

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
                    <div className="border-b border-border px-5 py-3">
                      <div className="text-sm font-semibold">
                        {detail.data.participants
                          .filter((p) => p.trim().length > 0)
                          .join(", ") || detail.data.title || "Care team"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {detail.data.messages.length}{" "}
                        {detail.data.messages.length === 1 ? "message" : "messages"}
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-5 py-4 bg-secondary/30">
                      <MessageThread messages={detail.data.messages} />
                    </div>
                    <AiSuggestions
                      conversationId={activeId}
                      onPick={(text) => setComposerSeed(text)}
                    />
                    <MessageComposer
                      pending={send.isPending}
                      seed={composerSeed}
                      onSend={(body) => send.mutateAsync(body).then(() => undefined)}
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
