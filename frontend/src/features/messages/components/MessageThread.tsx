import { useEffect, useRef } from "react";
import { AlertCircle, MessageSquarePlus } from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import type { Message, Participant } from "../types";
import { cn, formatTime } from "@/lib/utils";

interface Props {
  messages: Message[];
  participant: Participant;
  /** True when the user hasn't sent the first message yet (draft chat). */
  isDraft?: boolean;
}

interface RenderedItem {
  type: "divider" | "message";
  key: string;
  /** For divider rows. */
  label?: string;
  /** For message rows. */
  message?: Message;
  /** True if this message visually starts a sender group. */
  groupStart?: boolean;
  /** True if this is the last message in a sender group. */
  groupEnd?: boolean;
}

/**
 * Decorates the raw message list with date dividers and sender-group
 * boundaries. Grouping rule: consecutive messages from the same side
 * (incoming vs outgoing) within ~5 minutes share the same group —
 * avatars only on the first, time only on the last.
 */
function decorate(messages: Message[]): RenderedItem[] {
  const items: RenderedItem[] = [];
  let lastDay = "";
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    const day = new Date(m.sentAt).toDateString();
    if (day !== lastDay) {
      items.push({
        type: "divider",
        key: `div:${day}`,
        label: dividerLabel(m.sentAt),
      });
      lastDay = day;
    }

    const prev = messages[i - 1];
    const next = messages[i + 1];
    const groupStart =
      !prev ||
      prev.direction !== m.direction ||
      new Date(m.sentAt).toDateString() !== new Date(prev.sentAt).toDateString() ||
      diffMinutes(prev.sentAt, m.sentAt) > 5;
    const groupEnd =
      !next ||
      next.direction !== m.direction ||
      new Date(m.sentAt).toDateString() !== new Date(next.sentAt).toDateString() ||
      diffMinutes(m.sentAt, next.sentAt) > 5;

    items.push({
      type: "message",
      key: `m:${m.id}`,
      message: m,
      groupStart,
      groupEnd,
    });
  }
  return items;
}

export function MessageThread({ messages, participant, isDraft = false }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const items = decorate(messages);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-1 bg-white">
      {messages.length === 0 ? (
        <DraftIntro participant={participant} isDraft={isDraft} />
      ) : (
        items.map((item) =>
          item.type === "divider" ? (
            <DateDivider key={item.key} label={item.label!} />
          ) : (
            <Bubble
              key={item.key}
              message={item.message!}
              participant={participant}
              groupStart={item.groupStart!}
              groupEnd={item.groupEnd!}
            />
          )
        )
      )}
      <div ref={endRef} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Bubble({
  message,
  participant,
  groupStart,
  groupEnd,
}: {
  message: Message;
  participant: Participant;
  groupStart: boolean;
  groupEnd: boolean;
}) {
  const outgoing = message.direction === "outgoing";

  return (
    <div
      className={cn(
        "flex items-end gap-2",
        outgoing ? "justify-end" : "justify-start",
        groupStart ? "mt-3" : "mt-0.5"
      )}
    >
      {!outgoing && (
        <div className="size-7 shrink-0 self-end">
          {groupEnd ? (
            <UserAvatar
              name={participant.name}
              src={participant.avatarUrl}
              size="sm"
            />
          ) : (
            <div className="size-7" />
          )}
        </div>
      )}

      <div
        className={cn(
          "flex flex-col",
          outgoing ? "items-end" : "items-start",
          "max-w-[min(560px,75%)]"
        )}
      >
        <div
          className={cn(
            "px-3.5 py-2 text-sm leading-relaxed shadow-sm",
            outgoing
              ? "bg-primary text-primary-foreground"
              : "bg-surface-subtle text-foreground border border-border",
            outgoing
              ? bubbleCornersRight(groupStart, groupEnd)
              : bubbleCornersLeft(groupStart, groupEnd)
          )}
        >
          {message.urgent && (
            <div
              className={cn(
                "mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider",
                outgoing ? "text-amber-100" : "text-danger"
              )}
            >
              <AlertCircle className="size-3" /> Urgent
            </div>
          )}
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
        </div>
        {groupEnd && (
          <div
            className={cn(
              "mt-1 px-1 text-[10px] text-muted-foreground tabular-nums",
              outgoing ? "text-right" : "text-left"
            )}
          >
            {formatTime(message.sentAt)}
          </div>
        )}
      </div>

      {outgoing && <div className="size-7 shrink-0" />}
    </div>
  );
}

function bubbleCornersLeft(start: boolean, end: boolean): string {
  // Pointed corner only on the side where the group "lands"; the
  // opposite side stays fully rounded.
  return cn(
    "rounded-2xl",
    start && !end && "rounded-bl-md",
    !start && end && "rounded-tl-md",
    !start && !end && "rounded-tl-md rounded-bl-md"
  );
}

function bubbleCornersRight(start: boolean, end: boolean): string {
  return cn(
    "rounded-2xl",
    start && !end && "rounded-br-md",
    !start && end && "rounded-tr-md",
    !start && !end && "rounded-tr-md rounded-br-md"
  );
}

/* -------------------------------------------------------------------------- */

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function dividerLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "Today";

  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate();
  if (isYesterday) return "Yesterday";

  // Within the last week → weekday name.
  const dayDiff = Math.round((now.getTime() - d.getTime()) / 86_400_000);
  if (dayDiff < 7) {
    return d.toLocaleDateString("en-US", { weekday: "long" });
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function diffMinutes(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 60_000;
}

/* -------------------------------------------------------------------------- */

function DraftIntro({
  participant,
  isDraft,
}: {
  participant: Participant;
  isDraft: boolean;
}) {
  return (
    <div className="flex-1 grid place-items-center px-6 py-12 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-3 inline-block">
          <UserAvatar
            name={participant.name}
            src={participant.avatarUrl}
            size="xl"
          />
        </div>
        <div className="text-base font-bold">{participant.name}</div>
        {participant.specialty || participant.role || participant.email ? (
          <div className="text-xs text-muted-foreground mt-0.5">
            {[participant.specialty, participant.role && cap(participant.role)]
              .filter(Boolean)
              .join(" · ")}
            {participant.email && (
              <>
                {participant.specialty || participant.role ? " · " : ""}
                {participant.email}
              </>
            )}
          </div>
        ) : null}
        <div className="mt-5 inline-flex items-center gap-2 text-xs text-muted-foreground bg-surface-subtle rounded-full px-3 py-1.5">
          <MessageSquarePlus className="size-3.5" />
          {isDraft
            ? "Say something to start the conversation"
            : "No messages yet"}
        </div>
      </div>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
