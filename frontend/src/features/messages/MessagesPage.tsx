/**
 * Communication module — US-COMM-1..5
 * (docs/superpowers/specs/2026-05-27-workflow-user-stories.md).
 */
import { useMemo, useState } from "react";
import { MessageSquarePlus, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMessagesStore } from "./store";
import { ConversationList } from "./components/ConversationList";
import { ParticipantHeader } from "./components/ParticipantHeader";
import { MessageThread } from "./components/MessageThread";
import { MessageComposer } from "./components/MessageComposer";
import { ComposeMessageModal } from "./components/ComposeMessageModal";
import type { Audience, ConditionTag } from "./types";
import { cn } from "@/lib/utils";

export function MessagesPage() {
  const conversations = useMessagesStore((s) => s.conversations);
  const messages = useMessagesStore((s) => s.messages);
  const audience = useMessagesStore((s) => s.activeAudience);
  const setAudience = useMessagesStore((s) => s.setAudience);
  const activeId = useMessagesStore((s) => s.activeConversationId);
  const setActiveConversation = useMessagesStore((s) => s.setActiveConversation);
  const sendReply = useMessagesStore((s) => s.sendReply);

  const [query, setQuery] = useState("");
  const [condition, setCondition] = useState<ConditionTag | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations
      .filter((c) => c.audience === audience)
      .filter((c) =>
        audience === "patient" && condition
          ? c.participant.conditionTag === condition
          : true
      )
      .filter((c) => {
        if (!q) return true;
        return (
          c.participant.name.toLowerCase().includes(q) ||
          c.lastMessage.toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime()
      );
  }, [conversations, audience, condition, query]);

  const active = filtered.find((c) => c.id === activeId) ?? null;
  const threadMessages = useMemo(
    () =>
      active
        ? messages
            .filter((m) => m.conversationId === active.id)
            .sort(
              (a, b) =>
                new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
            )
        : [],
    [messages, active]
  );

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
              onSelect={setActiveConversation}
              query={query}
              onQueryChange={setQuery}
              showFilters={audience === "patient"}
              activeCondition={condition}
              onConditionChange={setCondition}
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {active ? (
              <>
                <ParticipantHeader participant={active.participant} />
                <MessageThread
                  messages={threadMessages}
                  participantName={active.participant.name}
                />
                <MessageComposer onSend={(body) => sendReply(active.id, body)} />
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
