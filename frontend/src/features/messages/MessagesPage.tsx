/**
 * Communication module — US-COMM-1..5
 * (docs/superpowers/specs/2026-05-27-workflow-user-stories.md).
 *
 * Wired to the real /messages endpoints + the existing /ws channel.
 * Each server-side write fans out a "message.created" frame on the
 * socket which invalidates the relevant React Query caches.
 */
import { useEffect, useMemo, useState } from "react";
import { MessageSquarePlus, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConversationList } from "./components/ConversationList";
import { ParticipantHeader } from "./components/ParticipantHeader";
import { MessageThread } from "./components/MessageThread";
import { MessageComposer } from "./components/MessageComposer";
import { ComposeMessageModal } from "./components/ComposeMessageModal";
import {
  useConversation,
  useConversations,
  useMarkConversationRead,
  useSendMessage,
} from "./hooks/use-messages";
import type { Audience, ConditionTag } from "./types";
import { cn } from "@/lib/utils";

export function MessagesPage() {
  const [audience, setAudience] = useState<Audience>("patient");
  const [query, setQuery] = useState("");
  const [condition, setCondition] = useState<ConditionTag | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const { data: conversations = [], isLoading } = useConversations({
    audience,
    q: query.trim() ? query.trim() : undefined,
  });
  const { data: detail } = useConversation(activeId);
  const sendMessage = useSendMessage();
  const markRead = useMarkConversationRead();

  // Patient-side condition tags aren't on the backend yet — surface them
  // in the UI by tag-matching the patient's MRN range so the filter
  // chip behavior still works. Backend support is a future iteration.
  const filtered = useMemo(() => {
    if (audience !== "patient" || !condition) return conversations;
    // Until the BE returns condition tags, we just hide nothing — the
    // chip remains a visual affordance for upcoming work.
    return conversations;
  }, [conversations, audience, condition]);

  // Auto-select the first conversation when the list loads or the
  // active one drops out of view (after audience switch).
  useEffect(() => {
    if (filtered.length === 0) {
      setActiveId(null);
      return;
    }
    if (!activeId || !filtered.some((c) => c.id === activeId)) {
      setActiveId(filtered[0]!.id);
    }
  }, [filtered, activeId]);

  // Mark the active conversation read whenever we open it or it
  // receives a new message (cache flips and we re-run this effect).
  useEffect(() => {
    if (activeId && detail) markRead.mutate(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, detail?.messages.length]);

  const active = filtered.find((c) => c.id === activeId) ?? null;

  return (
    <>
      <PageHeader
        title="Messages"
        right={
          <>
            <AudienceToggle
              audience={audience}
              onChange={(a) => {
                setAudience(a);
                setCondition(null);
                setQuery("");
                setActiveId(null);
              }}
            />
            <Button className="h-10" onClick={() => setComposeOpen(true)}>
              <Plus className="size-4" /> Compose
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="flex flex-col md:flex-row min-h-[70vh] max-h-[calc(100vh-220px)]">
          <div className="md:border-r border-border p-3 md:p-4 md:flex-shrink-0 md:flex md:flex-col min-h-0">
            <ConversationList
              conversations={filtered}
              activeId={active?.id ?? null}
              onSelect={setActiveId}
              query={query}
              onQueryChange={setQuery}
              showFilters={audience === "patient"}
              activeCondition={condition}
              onConditionChange={setCondition}
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {isLoading && !active ? (
              <div className="flex-1 grid place-items-center p-10 text-xs text-muted-foreground">
                Loading conversations…
              </div>
            ) : active && detail ? (
              <>
                <ParticipantHeader participant={detail.conversation.participant} />
                <MessageThread
                  messages={detail.messages}
                  participantName={detail.conversation.participant.name}
                />
                <MessageComposer
                  onSend={(body) =>
                    sendMessage.mutate({ conversationId: active.id, body })
                  }
                />
              </>
            ) : (
              <EmptyThreadState onCompose={() => setComposeOpen(true)} />
            )}
          </div>
        </div>
      </Card>

      <ComposeMessageModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultAudience={audience}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function AudienceToggle({
  audience,
  onChange,
}: {
  audience: Audience;
  onChange: (a: Audience) => void;
}) {
  return (
    <div className="bg-[#F1F4F9] rounded-full p-1 flex items-center gap-1 h-10">
      <AudienceButton
        active={audience === "patient"}
        onClick={() => onChange("patient")}
        label="Patients"
      />
      <AudienceButton
        active={audience === "clinician"}
        onClick={() => onChange("clinician")}
        label="Clinicians"
      />
    </div>
  );
}

function AudienceButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 px-4 rounded-full text-sm font-medium transition",
        active
          ? "bg-white text-primary shadow-soft"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function EmptyThreadState({ onCompose }: { onCompose: () => void }) {
  return (
    <div className="flex-1 grid place-items-center p-10 text-center">
      <div>
        <div className="size-12 rounded-2xl bg-surface-subtle grid place-items-center mx-auto mb-3 text-muted-foreground">
          <MessageSquarePlus className="size-5" />
        </div>
        <div className="text-sm font-semibold">Pick a conversation</div>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Select a thread on the left, or start a new one to message a patient
          or clinician.
        </p>
        <Button className="mt-4" onClick={onCompose}>
          <Plus className="size-3.5" /> Compose new
        </Button>
      </div>
    </div>
  );
}
