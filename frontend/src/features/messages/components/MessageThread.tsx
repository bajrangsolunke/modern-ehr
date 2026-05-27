import { useEffect, useRef } from "react";
import {
  AlertCircle,
  Check,
  CheckCheck,
  FileText,
  Image as ImageIcon,
  MessageSquarePlus,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import { env } from "@/config/env";
import { STORAGE_KEYS } from "@/config/constants";
import { toast } from "@/lib/toast";
import type { Attachment, Message, Participant } from "../types";
import { cn, formatBytes, formatTime } from "@/lib/utils";

interface Props {
  messages: Message[];
  /** The conversation's primary "other side". Used for the patient
   *  thread (single counterpart) and as the fallback when a staff
   *  sender can't be resolved in `participants`. */
  participant: Participant;
  /** Full participant list for clinician threads — drives per-message
   *  avatar + name attribution. Empty for patient threads. */
  participants?: Participant[];
  /** Current viewer's user id — drives which bubbles render as
   *  "outgoing" (mine) vs "incoming" (theirs). Without this, every
   *  staff-sent message would look like it came from the viewer. */
  viewerId: string | undefined;
  /** True when the user hasn't sent the first message yet (draft chat). */
  isDraft?: boolean;
  /** Highest last_read_at across other staff participants — outgoing
   *  bubbles sent at/before this timestamp show as read. Null for
   *  patient threads or unread threads. */
  readWatermark?: string | null;
  /** When non-empty, render a "{name} is typing…" indicator below the
   *  last message. */
  typingNames?: string[];
}

function isOutgoing(message: Message, viewerId: string | undefined): boolean {
  // The current viewer's messages render right-aligned. Staff-sent
  // messages from OTHER users are incoming, even though both sides
  // are "from staff" — that's the bug this comment exists to flag.
  return Boolean(viewerId && message.senderUserId === viewerId);
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
function decorate(
  messages: Message[],
  viewerId: string | undefined
): RenderedItem[] {
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
    const mOut = isOutgoing(m, viewerId);
    const prevOut = prev ? isOutgoing(prev, viewerId) : null;
    const nextOut = next ? isOutgoing(next, viewerId) : null;

    const groupStart =
      !prev ||
      prevOut !== mOut ||
      new Date(m.sentAt).toDateString() !== new Date(prev.sentAt).toDateString() ||
      diffMinutes(prev.sentAt, m.sentAt) > 5 ||
      // Different sender on the same side (group threads) — break.
      (mOut === false && prev.senderUserId !== m.senderUserId);
    const groupEnd =
      !next ||
      nextOut !== mOut ||
      new Date(m.sentAt).toDateString() !== new Date(next.sentAt).toDateString() ||
      diffMinutes(m.sentAt, next.sentAt) > 5 ||
      (mOut === false && next.senderUserId !== m.senderUserId);

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

export function MessageThread({
  messages,
  participant,
  participants = [],
  viewerId,
  isDraft = false,
  readWatermark = null,
  typingNames = [],
}: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const items = decorate(messages, viewerId);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-1 bg-white">
      {messages.length === 0 ? (
        <DraftIntro participant={participant} isDraft={isDraft} />
      ) : (
        items.map((item) => {
          if (item.type === "divider") {
            return <DateDivider key={item.key} label={item.label!} />;
          }
          const m = item.message!;
          const outgoing = isOutgoing(m, viewerId);
          // For group threads, the bubble's avatar/name reflects the
          // actual sender (not the conversation's primary participant).
          const sender =
            participants.find((p) => p.id === m.senderUserId) ?? participant;
          return (
            <Bubble
              key={item.key}
              message={m}
              participant={sender}
              outgoing={outgoing}
              groupStart={item.groupStart!}
              groupEnd={item.groupEnd!}
              read={
                outgoing &&
                readWatermark !== null &&
                m.sentAt <= readWatermark
              }
            />
          );
        })
      )}
      {typingNames.length > 0 && <TypingIndicator names={typingNames} />}
      <div ref={endRef} />
    </div>
  );
}

function TypingIndicator({ names }: { names: string[] }) {
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names.length} people are typing`;
  return (
    <div className="flex items-end gap-2 mt-2 pl-9">
      <div className="bg-surface-subtle border border-border rounded-2xl px-3.5 py-2 inline-flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="flex gap-1" aria-hidden="true">
          <Dot delay="0ms" />
          <Dot delay="150ms" />
          <Dot delay="300ms" />
        </span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 rounded-full bg-muted-foreground/70 animate-bounce"
      style={{ animationDelay: delay, animationDuration: "1s" }}
    />
  );
}

/* -------------------------------------------------------------------------- */

function Bubble({
  message,
  participant,
  outgoing,
  groupStart,
  groupEnd,
  read,
}: {
  message: Message;
  participant: Participant;
  outgoing: boolean;
  groupStart: boolean;
  groupEnd: boolean;
  read: boolean;
}) {

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
          {message.body && (
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
          )}
          {message.attachments && message.attachments.length > 0 && (
            <AttachmentList
              attachments={message.attachments}
              outgoing={outgoing}
              hasBody={Boolean(message.body)}
            />
          )}
        </div>
        {groupEnd && (
          <div
            className={cn(
              "mt-1 px-1 text-[10px] text-muted-foreground tabular-nums inline-flex items-center gap-1",
              outgoing ? "self-end" : "self-start"
            )}
          >
            <span>{formatTime(message.sentAt)}</span>
            {outgoing &&
              (read ? (
                <CheckCheck
                  className="size-3 text-primary"
                  aria-label="Read"
                />
              ) : (
                <Check
                  className="size-3 text-muted-foreground"
                  aria-label="Sent"
                />
              ))}
          </div>
        )}
      </div>

      {outgoing && <div className="size-7 shrink-0" />}
    </div>
  );
}

async function downloadAttachment(a: Attachment): Promise<void> {
  const token = localStorage.getItem(STORAGE_KEYS.accessToken);
  try {
    const res = await fetch(`${env.API_BASE_URL}/documents/${a.id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error(res.statusText || "Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = a.name;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error("Couldn't download attachment", {
      description: err instanceof Error ? err.message : undefined,
    });
  }
}

function AttachmentList({
  attachments,
  outgoing,
  hasBody,
}: {
  attachments: Attachment[];
  outgoing: boolean;
  hasBody: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", hasBody && "mt-2")}>
      {attachments.map((a) => {
        const isImage = a.mimeType.startsWith("image/");
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => downloadAttachment(a)}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-xl text-left transition",
              outgoing
                ? "bg-white/15 hover:bg-white/25 text-white"
                : "bg-white border border-border hover:border-foreground/30"
            )}
          >
            <div
              className={cn(
                "size-7 rounded-lg grid place-items-center shrink-0 [&_svg]:size-3.5",
                outgoing
                  ? "bg-white/15 text-white"
                  : isImage
                    ? "bg-info/10 text-info"
                    : a.mimeType === "application/pdf"
                      ? "bg-danger/10 text-danger"
                      : "bg-primary/10 text-primary"
              )}
            >
              {isImage ? <ImageIcon aria-label="" /> : <FileText />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold truncate">{a.name}</div>
              <div
                className={cn(
                  "text-[10px]",
                  outgoing ? "text-white/70" : "text-muted-foreground"
                )}
              >
                {formatBytes(a.sizeBytes)}
              </div>
            </div>
          </button>
        );
      })}
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
