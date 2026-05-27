/**
 * Communication module — US-COMM-1..5
 * (docs/superpowers/specs/2026-05-27-workflow-user-stories.md).
 *
 * Wired to the real /messages endpoints + the existing /ws channel.
 * Each server-side write fans out a "message.created" frame on the
 * socket which invalidates the relevant React Query caches.
 *
 * The "My Users" tab (audience=clinician) shows every active user —
 * not just the ones you've already messaged. Clicking a user without
 * an existing thread opens an empty draft; the first message triggers
 * createClinicianConversation server-side and switches us to the new
 * persistent thread.
 */
import { useEffect, useMemo, useState } from "react";
import { MessageSquarePlus, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ConversationList,
  rowKey,
  type ConversationRow,
} from "./components/ConversationList";
import { ParticipantHeader } from "./components/ParticipantHeader";
import { MessageThread } from "./components/MessageThread";
import { MessageComposer } from "./components/MessageComposer";
import { ComposeMessageModal } from "./components/ComposeMessageModal";
import {
  useConversation,
  useConversations,
  useMarkConversationRead,
  useSendMessage,
  useComposeBroadcast,
} from "./hooks/use-messages";
import { useUsers } from "@/features/users/hooks/use-users";
import { useAuthStore } from "@/stores/auth-store";
import {
  selectTypingUsers,
  useTypingStore,
} from "./stores/typing-store";
import { messagesApi } from "./api/messages-api";
import type { Audience, ConditionTag, Participant } from "./types";
import { cn } from "@/lib/utils";

export function MessagesPage() {
  const currentUser = useAuthStore((s) => s.user);

  const [audience, setAudience] = useState<Audience>("patient");
  const [query, setQuery] = useState("");
  const [condition, setCondition] = useState<ConditionTag | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null
  );
  const [activeDraftUserId, setActiveDraftUserId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const { data: conversations = [], isLoading } = useConversations({
    audience,
    q: query.trim() ? query.trim() : undefined,
  });
  const { data: detail } = useConversation(activeConversationId);
  const sendMessage = useSendMessage();
  const compose = useComposeBroadcast();
  const markRead = useMarkConversationRead();

  // Pull every active staff user — only enabled on the My Users tab.
  const usersQuery = useUsers(
    audience === "clinician"
      ? { page: 1, page_size: 100, is_active: true }
      : { page: 1, page_size: 1 }
  );
  const allUsers = audience === "clinician" ? usersQuery.data?.items ?? [] : [];

  // Build the unified row list.
  const rows: ConversationRow[] = useMemo(() => {
    if (audience === "patient") {
      let visible = conversations;
      if (condition) {
        visible = visible.filter((c) => c.participant.conditionTag === condition);
      }
      return visible.map((c) => ({ kind: "conversation" as const, conversation: c }));
    }

    // My Users tab — combine existing conversations + remaining users.
    const conversationByUserId = new Map<string, ConversationRow>();
    for (const c of conversations) {
      const userId = c.participant.id;
      conversationByUserId.set(userId, {
        kind: "conversation",
        conversation: c,
      });
    }

    const ordered: ConversationRow[] = [];
    // Existing conversations first (in their server-sorted order — most
    // recent at the top), then the remaining users alphabetical.
    for (const c of conversations) {
      ordered.push({ kind: "conversation", conversation: c });
    }
    const remaining: ConversationRow[] = allUsers
      .filter(
        (u) =>
          u.id !== currentUser?.id && // don't message yourself
          !conversationByUserId.has(u.id)
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((u) => ({
        kind: "draft" as const,
        userId: u.id,
        participant: {
          id: u.id,
          audience: "clinician" as const,
          name: u.fullName,
          avatarUrl: u.avatarUrl ?? undefined,
          email: u.email,
          role: u.role,
          specialty: u.specialty ?? undefined,
        } satisfies Participant,
      }));

    const q = query.trim().toLowerCase();
    const all = [...ordered, ...remaining];
    if (!q) return all;
    return all.filter((r) => {
      const p = r.kind === "conversation" ? r.conversation.participant : r.participant;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.email?.toLowerCase().includes(q) ?? false) ||
        (r.kind === "conversation" &&
          r.conversation.lastMessage.toLowerCase().includes(q))
      );
    });
  }, [audience, conversations, condition, allUsers, query, currentUser?.id]);

  // The "active" row is either a real conversation or a draft user.
  const activeKey = activeConversationId
    ? `c:${activeConversationId}`
    : activeDraftUserId
      ? `d:${activeDraftUserId}`
      : null;

  // Auto-select first row when the list loads or selection drops out.
  useEffect(() => {
    if (rows.length === 0) {
      setActiveConversationId(null);
      setActiveDraftUserId(null);
      return;
    }
    const stillVisible =
      activeKey !== null && rows.some((r) => rowKey(r) === activeKey);
    if (!stillVisible) {
      const first = rows[0]!;
      if (first.kind === "conversation") {
        setActiveConversationId(first.conversation.id);
        setActiveDraftUserId(null);
      } else {
        setActiveConversationId(null);
        setActiveDraftUserId(first.userId);
      }
    }
  }, [rows, activeKey]);

  // Mark the active conversation read whenever we open it or it
  // receives a new message.
  useEffect(() => {
    if (activeConversationId && detail) markRead.mutate(activeConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, detail?.messages.length]);

  const draftParticipant: Participant | null = useMemo(() => {
    if (!activeDraftUserId) return null;
    const row = rows.find(
      (r) => r.kind === "draft" && r.userId === activeDraftUserId
    );
    return row && row.kind === "draft" ? row.participant : null;
  }, [activeDraftUserId, rows]);

  const handleSelect = (row: ConversationRow) => {
    if (row.kind === "conversation") {
      setActiveConversationId(row.conversation.id);
      setActiveDraftUserId(null);
    } else {
      setActiveDraftUserId(row.userId);
      setActiveConversationId(null);
    }
  };

  const handleSendActive = async (
    body: string,
    attachments: import("@/features/docs/api/docs-api").Document[]
  ) => {
    if (activeConversationId) {
      await sendMessage.mutateAsync({
        conversationId: activeConversationId,
        body,
        documentIds: attachments.map((a) => a.id),
      });
      return;
    }
    if (activeDraftUserId) {
      // Clinician drafts don't support attachments yet (backend rejects
      // them) — silently drop any staged attachments here.
      const results = await compose.mutateAsync({
        audience: "clinician",
        recipientIds: [activeDraftUserId],
        body,
        urgent: false,
      });
      const created = results[0];
      if (created) {
        setActiveConversationId(created.conversation.id);
        setActiveDraftUserId(null);
      }
    }
  };

  const activeParticipant: Participant | null = detail
    ? detail.conversation.participant
    : draftParticipant;

  // Highest last_read_at across other staff participants. Outgoing
  // bubbles sent at or before this timestamp are "read". Patient
  // threads have no staff "other side" — read receipts only show for
  // clinician threads.
  const readWatermark = useMemo<string | null>(() => {
    if (!detail || !currentUser) return null;
    let max: string | null = null;
    for (const p of detail.participants) {
      if (p.id === currentUser.id) continue;
      if (!p.lastReadAt) continue;
      if (max === null || p.lastReadAt > max) max = p.lastReadAt;
    }
    return max;
  }, [detail, currentUser]);

  // Resolve typing user IDs → display names. Falls back to "Someone"
  // when we don't have the user in the participants projection yet.
  const typingUserIds = useTypingStore((s) =>
    selectTypingUsers(s, activeConversationId)
  );
  const typingNames = useMemo(() => {
    if (!detail || !currentUser) return [];
    return typingUserIds
      .filter((uid) => uid !== currentUser.id)
      .map((uid) => {
        const p = detail.participants.find((x) => x.id === uid);
        return p?.name ?? "Someone";
      });
  }, [typingUserIds, detail, currentUser]);

  const pingTyping = () => {
    if (activeConversationId) {
      // Best-effort ping; failures are silent (the indicator just
      // won't render on the other side).
      messagesApi.pingTyping(activeConversationId).catch(() => {});
    }
  };

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
                setActiveConversationId(null);
                setActiveDraftUserId(null);
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
              rows={rows}
              activeKey={activeKey}
              onSelect={handleSelect}
              query={query}
              onQueryChange={setQuery}
              showFilters={audience === "patient"}
              activeCondition={condition}
              onConditionChange={setCondition}
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {isLoading && !activeParticipant ? (
              <div className="flex-1 grid place-items-center p-10 text-xs text-muted-foreground">
                Loading conversations…
              </div>
            ) : activeParticipant ? (
              <>
                <ParticipantHeader participant={activeParticipant} />
                <MessageThread
                  messages={detail?.messages ?? []}
                  participant={activeParticipant}
                  isDraft={!detail}
                  readWatermark={readWatermark}
                  typingNames={typingNames}
                />
                <MessageComposer
                  onSend={handleSendActive}
                  busy={sendMessage.isPending || compose.isPending}
                  onTyping={activeConversationId ? pingTyping : undefined}
                  onSuggest={
                    activeConversationId
                      ? () => messagesApi.suggestReply(activeConversationId)
                      : undefined
                  }
                  patientId={
                    activeParticipant.audience === "patient"
                      ? activeParticipant.id
                      : undefined
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
        label="My Users"
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
