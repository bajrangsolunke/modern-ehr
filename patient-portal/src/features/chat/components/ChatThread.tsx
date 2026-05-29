/**
 * Patient-portal chat thread. Bubble-style layout with avatars,
 * timestamps (relative + hover-absolute), citation chips, refusal-
 * aware "Message care team" CTA, copy + retry actions, and an
 * auto-growing composer.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  MessageSquare,
  RotateCw,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/config/constants";
import { chatApi, type ChatAnswer, type ChatCitation } from "../api/chat-api";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Message =
  | { id: string; role: "user"; content: string; ts: number }
  | {
      id: string;
      role: "ai";
      content: string;
      citations: ChatCitation[];
      model: string;
      ts: number;
      isRefusal: boolean;
    }
  | {
      id: string;
      role: "error";
      content: string;
      ts: number;
      retryQuestion: string;
    };

const SAMPLE_QUESTIONS = [
  "When is my next appointment?",
  "What medications am I taking?",
  "Summarize my last visit",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const newId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Minutes-relative timestamp ("just now", "2m", "1h", "3d"). */
function relTime(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 30) return "just now";
  if (s < 90) return "1m";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Absolute timestamp for the tooltip — locale-aware. */
function absTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Pattern-match the AI response for refusal language. When true, the
 *  bubble surfaces a "Message care team" CTA so the patient has a
 *  one-tap path forward when the bot won't answer a clinical question. */
function detectRefusal(answer: string): boolean {
  const text = answer.toLowerCase();
  const cues = [
    "not able to give medical advice",
    "i'm not a doctor",
    "i am not a doctor",
    "please message your care team",
    "please contact your care team",
    "please reach out to your care team",
    "talk to your care team",
    "ask your care team",
    "consult your care team",
    "i can't give medical advice",
    "i cannot give medical advice",
    "i'm not able to provide medical advice",
  ];
  return cues.some((c) => text.includes(c));
}

// ---------------------------------------------------------------------------
// Citation chip
// ---------------------------------------------------------------------------

function CitationLine({ c }: { c: ChatCitation }) {
  if (c.type === "section" && c.name) {
    const count = typeof c.count === "number" ? ` · ${c.count}` : "";
    return (
      <li className="text-[11px] text-muted-foreground leading-tight">
        <span className="font-semibold text-foreground/80">{c.name}</span>
        {count && <span className="text-muted-foreground">{count}</span>}
      </li>
    );
  }
  if (c.snippet) {
    return (
      <li className="text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground/80">
          {c.name ?? "From your records"}
        </span>
        <p className="italic mt-0.5 line-clamp-2">&ldquo;{c.snippet}&rdquo;</p>
      </li>
    );
  }
  return null;
}

function CitationChip({ citations }: { citations: ChatCitation[] }) {
  const [open, setOpen] = useState(false);
  if (citations.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
          "text-[11px] font-medium",
          "bg-primary/10 text-primary hover:bg-primary/15 transition-colors",
        )}
      >
        <BookOpen className="size-2.5" />
        Based on {citations.length} source{citations.length === 1 ? "" : "s"}
        <ChevronDown
          className={cn("size-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul className="mt-2 space-y-1 pl-2 border-l-2 border-primary/30">
          {citations.map((c, i) => (
            <CitationLine key={i} c={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bubble actions row (copy + message-care-team)
// ---------------------------------------------------------------------------

function BubbleActions({
  text,
  isRefusal,
}: {
  text: string;
  isRefusal: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — silently no-op; user can long-press to copy
    }
  };

  return (
    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={copy}
        aria-label="Copy answer"
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
          "text-[11px] font-medium",
          "text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors",
        )}
      >
        {copied ? (
          <>
            <Check className="size-2.5" />
            Copied
          </>
        ) : (
          <>
            <Copy className="size-2.5" />
            Copy
          </>
        )}
      </button>
      {isRefusal && (
        <button
          type="button"
          onClick={() => navigate(ROUTES.messages)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5",
            "text-[11px] font-semibold",
            "bg-primary text-white hover:brightness-105 transition-all",
          )}
        >
          <MessageSquare className="size-2.5" />
          Message care team
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bubble components
// ---------------------------------------------------------------------------

function AiBubble({
  content,
  citations,
  ts,
  now,
  isRefusal,
}: {
  content: string;
  citations: ChatCitation[];
  model: string;
  ts: number;
  now: number;
  isRefusal: boolean;
}) {
  return (
    <div className="flex gap-2 items-end">
      <div
        className="size-8 rounded-full grid place-items-center shrink-0 text-white shadow-sm"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.75))",
        }}
      >
        <Sparkles className="size-4" />
      </div>
      <div className="max-w-[82%] min-w-0">
        <div className="rounded-2xl rounded-bl-md bg-white border border-border px-3.5 py-2.5 shadow-sm">
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
            {content}
          </p>
          <CitationChip citations={citations} />
          <BubbleActions text={content} isRefusal={isRefusal} />
        </div>
        <div
          className="text-[10px] text-muted-foreground mt-1 ml-1"
          title={absTime(ts)}
        >
          {relTime(ts, now)}
        </div>
      </div>
    </div>
  );
}

function UserBubble({
  content,
  ts,
  now,
}: {
  content: string;
  ts: number;
  now: number;
}) {
  return (
    <div className="flex gap-2 items-end justify-end">
      <div className="max-w-[82%]">
        <div className="rounded-2xl rounded-br-md bg-primary text-white px-3.5 py-2.5 text-sm leading-relaxed break-words shadow-sm">
          {content}
        </div>
        <div
          className="text-[10px] text-muted-foreground mt-1 mr-1 text-right"
          title={absTime(ts)}
        >
          {relTime(ts, now)}
        </div>
      </div>
      <div className="size-8 rounded-full bg-secondary grid place-items-center shrink-0 text-muted-foreground">
        <User className="size-4" />
      </div>
    </div>
  );
}

function ErrorBubble({
  content,
  onRetry,
}: {
  content: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex gap-2 items-end">
      <div className="size-8 rounded-full bg-danger/15 grid place-items-center shrink-0 text-danger">
        <Sparkles className="size-4" />
      </div>
      <div className="max-w-[82%] rounded-2xl rounded-bl-md bg-danger/5 border border-danger/30 text-danger px-3.5 py-2.5 text-sm leading-relaxed">
        {content}
        <div className="mt-2">
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5",
              "text-[11px] font-semibold",
              "bg-danger text-white hover:brightness-105 transition-all",
            )}
          >
            <RotateCw className="size-2.5" />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex gap-2 items-end">
      <div
        className="size-8 rounded-full grid place-items-center shrink-0 text-white shadow-sm"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.75))",
        }}
      >
        <Sparkles className="size-4" />
      </div>
      <div className="rounded-2xl rounded-bl-md bg-white border border-border px-3.5 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 rounded-full bg-primary/60 animate-bounce"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ChatThread() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update relative timestamps every 30s without re-rendering on every frame.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Autofocus on mount + scroll to bottom on new messages.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-grow the composer textarea up to its max height as the user types.
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, []);
  useEffect(() => {
    resizeTextarea();
  }, [draft, resizeTextarea]);

  const mutation = useMutation({
    mutationFn: (question: string) => chatApi.ask(question),
    onSuccess: (data: ChatAnswer, question) => {
      const ts = Date.now();
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "user", content: question, ts },
        {
          id: newId(),
          role: "ai",
          content: data.answer,
          citations: data.citations,
          model: data.model,
          ts,
          isRefusal: detectRefusal(data.answer),
        },
      ]);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    onError: (err, question) => {
      const ts = Date.now();
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "user", content: question, ts },
        {
          id: newId(),
          role: "error",
          content:
            err instanceof Error
              ? err.message
              : "Something went wrong. Please try again.",
          ts,
          retryQuestion: question,
        },
      ]);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
  });

  const send = (questionOverride?: string) => {
    const q = (questionOverride ?? draft).trim();
    if (!q || mutation.isPending) return;
    setDraft("");
    mutation.mutate(q);
  };

  const retry = (question: string) => {
    if (mutation.isPending) return;
    // Drop the trailing error pair (user + error) so the retry replaces
    // them rather than stacking.
    setMessages((prev) => {
      const trimmed = [...prev];
      // last 2 messages should be user + error
      if (
        trimmed.length >= 2 &&
        trimmed[trimmed.length - 1].role === "error" &&
        trimmed[trimmed.length - 2].role === "user" &&
        trimmed[trimmed.length - 2].content === question
      ) {
        trimmed.splice(trimmed.length - 2, 2);
      }
      return trimmed;
    });
    mutation.mutate(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const isEmpty = useMemo(
    () => messages.length === 0 && !mutation.isPending,
    [messages, mutation.isPending],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {isEmpty && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-4">
            <div
              className="size-12 rounded-2xl grid place-items-center text-white shadow-md"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.75))",
              }}
            >
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">
                Hi! What can I help you with?
              </p>
              <p className="text-xs text-muted-foreground max-w-[280px]">
                I can answer questions about your appointments, medications,
                and visits. For medical advice, please message your care team.
              </p>
            </div>
            <div className="flex flex-col gap-1.5 w-full">
              {SAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="text-xs text-left rounded-xl border border-border bg-white hover:border-primary/40 hover:text-primary px-3 py-2 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.role === "user")
            return (
              <UserBubble
                key={msg.id}
                content={msg.content}
                ts={msg.ts}
                now={now}
              />
            );
          if (msg.role === "ai")
            return (
              <AiBubble
                key={msg.id}
                content={msg.content}
                citations={msg.citations}
                model={msg.model}
                ts={msg.ts}
                now={now}
                isRefusal={msg.isRefusal}
              />
            );
          return (
            <ErrorBubble
              key={msg.id}
              content={msg.content}
              onRetry={() => retry(msg.retryQuestion)}
            />
          );
        })}

        {mutation.isPending && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 mt-3 flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            rows={1}
            placeholder="Type your question…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={mutation.isPending}
            className={cn(
              "text-sm resize-none rounded-2xl border-border bg-white",
              "min-h-[44px] max-h-32 py-3 pl-3.5 pr-12",
              "leading-snug overflow-y-auto",
            )}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={!draft.trim() || mutation.isPending}
            aria-label="Send"
            className={cn(
              "absolute right-2 bottom-2 size-8 rounded-full grid place-items-center transition",
              draft.trim() && !mutation.isPending
                ? "bg-primary text-white hover:brightness-105 shadow-sm scale-100"
                : "bg-muted text-muted-foreground cursor-not-allowed scale-95",
            )}
          >
            <Send className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
