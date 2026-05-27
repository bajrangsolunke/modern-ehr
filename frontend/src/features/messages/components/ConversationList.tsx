import { Search } from "lucide-react";
import { FilterChip } from "@/components/ui/filter-chip";
import type { ConditionTag, Conversation } from "../types";
import { conditionLabel, conditionTone } from "../utils";
import { cn, formatTime } from "@/lib/utils";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  showFilters: boolean;
  activeCondition: ConditionTag | null;
  onConditionChange: (c: ConditionTag | null) => void;
}

const CONDITIONS: ConditionTag[] = ["diabetic", "asthma", "cancer", "bp", "mental"];

export function ConversationList({
  conversations,
  activeId,
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
        {conversations.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border bg-surface-subtle p-6 text-center text-xs text-muted-foreground">
            No conversations match.
          </li>
        )}
        {conversations.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "w-full text-left rounded-2xl border bg-white p-3 transition ring-focus",
                activeId === c.id
                  ? "border-primary shadow-soft"
                  : "border-border hover:border-foreground/20"
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold truncate">
                    {c.participant.name}
                  </span>
                  {c.participant.conditionTag && (
                    <span
                      className={cn(
                        "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        conditionTone(c.participant.conditionTag)
                      )}
                    >
                      {conditionLabel(c.participant.conditionTag)}
                    </span>
                  )}
                </div>
                {c.unread > 0 && (
                  <span className="shrink-0 inline-grid place-items-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                    {c.unread}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">
                {c.lastMessage}
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {formatLastTime(c.lastMessageAt)}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function formatLastTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return `Today, ${formatTime(iso)}`;
  const dd = String(d.getMonth() + 1).padStart(2, "0");
  const mm = String(d.getDate()).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}, ${formatTime(iso)}`;
}
