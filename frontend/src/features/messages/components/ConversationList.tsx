import { Search } from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import { FilterChip } from "@/components/ui/filter-chip";
import type { ConditionTag, Conversation, Participant } from "../types";
import { conditionLabel, conditionTone } from "../utils";
import { cn, formatTime } from "@/lib/utils";

/**
 * A row in the conversation list. Existing conversations carry a real
 * id + last-message; "draft" rows are users you haven't messaged yet
 * (only used on the My Users tab — clicking opens an empty thread and
 * the first send creates the conversation server-side).
 */
export type ConversationRow =
  | {
      kind: "conversation";
      conversation: Conversation;
    }
  | {
      kind: "draft";
      userId: string;
      participant: Participant;
    };

interface Props {
  rows: ConversationRow[];
  activeKey: string | null;
  onSelect: (row: ConversationRow) => void;
  query: string;
  onQueryChange: (q: string) => void;
  showFilters: boolean;
  activeCondition: ConditionTag | null;
  onConditionChange: (c: ConditionTag | null) => void;
}

const CONDITIONS: ConditionTag[] = ["diabetic", "asthma", "cancer", "bp", "mental"];

export function ConversationList({
  rows,
  activeKey,
  onSelect,
  query,
  onQueryChange,
  showFilters,
  activeCondition,
  onConditionChange,
}: Props) {
  return (
    <aside className="w-full md:w-72 lg:w-80 shrink-0 flex flex-col gap-3 min-h-0">
      <div className="relative">
        <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search…"
          className="w-full h-9 rounded-full border border-border bg-white pl-9 pr-3 text-sm ring-focus"
        />
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label="All"
            active={activeCondition === null}
            onClick={() => onConditionChange(null)}
          />
          {CONDITIONS.map((c) => (
            <FilterChip
              key={c}
              label={conditionLabel(c)}
              active={activeCondition === c}
              onClick={() => onConditionChange(activeCondition === c ? null : c)}
            />
          ))}
        </div>
      )}

      <ul className="flex flex-col gap-2 overflow-y-auto pr-1 min-h-0">
        {rows.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border bg-surface-subtle p-6 text-center text-xs text-muted-foreground">
            No matches.
          </li>
        )}
        {rows.map((row) => (
          <ConversationRowItem
            key={rowKey(row)}
            row={row}
            active={rowKey(row) === activeKey}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </aside>
  );
}

function ConversationRowItem({
  row,
  active,
  onSelect,
}: {
  row: ConversationRow;
  active: boolean;
  onSelect: (row: ConversationRow) => void;
}) {
  const participant =
    row.kind === "conversation" ? row.conversation.participant : row.participant;
  const conv = row.kind === "conversation" ? row.conversation : null;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(row)}
        className={cn(
          "w-full text-left rounded-2xl border bg-white p-3 transition ring-focus",
          active
            ? "border-primary shadow-soft"
            : "border-border hover:border-foreground/20"
        )}
      >
        <div className="flex items-start gap-2.5">
          <UserAvatar
            name={participant.name}
            src={participant.avatarUrl}
            size="md"
          />
          <div className="min-w-0 flex-1">
            {/* Top row: name + condition badge on the left, time on the
                right. Standard messaging layout. */}
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold truncate">
                  {participant.name}
                </span>
                {participant.conditionTag && (
                  <span
                    className={cn(
                      "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      conditionTone(participant.conditionTag)
                    )}
                  >
                    {conditionLabel(participant.conditionTag)}
                  </span>
                )}
              </div>
              {conv && (
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  {formatLastTime(conv.lastMessageAt)}
                </span>
              )}
            </div>
            {/* Bottom row: last-message preview on the left, unread
                badge on the right. Drafts show specialty/role. */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground line-clamp-1 min-w-0 flex-1">
                {conv?.lastMessage ||
                  (participant.specialty ??
                    participant.role ??
                    "Start a conversation")}
              </p>
              {conv && conv.unread > 0 && (
                <span className="shrink-0 inline-grid place-items-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {conv.unread}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}

export function rowKey(row: ConversationRow): string {
  return row.kind === "conversation"
    ? `c:${row.conversation.id}`
    : `d:${row.userId}`;
}

function formatLastTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return formatTime(iso);

  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate();
  if (isYesterday) return "Yesterday";

  // Within the last week → weekday short name.
  const dayDiff = Math.round((now.getTime() - d.getTime()) / 86_400_000);
  if (dayDiff < 7) {
    return d.toLocaleDateString("en-US", { weekday: "short" });
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "2-digit",
  });
}
