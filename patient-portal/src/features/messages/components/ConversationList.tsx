import { UserAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/datetime";
import type { ConversationSummary } from "@/features/messages/api/messages-api";

interface Props {
  items: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ items, activeId, onSelect }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8 px-4">
        No conversations yet.
      </div>
    );
  }
  return (
    <ul className="space-y-1">
      {items.map((c) => {
        const isActive = c.id === activeId;
        const headline =
          c.participants.find((p) => p.trim().length > 0) ?? c.title ?? "Care team";
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "w-full text-left rounded-2xl px-3 py-2.5 flex items-start gap-3 transition-colors",
                isActive
                  ? "bg-primary/10 text-foreground"
                  : "hover:bg-secondary text-foreground"
              )}
            >
              <UserAvatar name={headline} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate">
                    {headline}
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                    {relativeTime(c.last_message_at)}
                  </span>
                </div>
                {c.last_message_preview && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {c.last_message_preview}
                  </p>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
