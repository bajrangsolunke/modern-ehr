/**
 * Patient-portal chat thread. Bubble-style layout, plain-language
 * sample questions, typing-dots loader. Mirrors the provider portal
 * chat but with patient-friendly copy.
 */
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, User } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { chatApi, type ChatAnswer, type ChatCitation } from "../api/chat-api";
import { cn } from "@/lib/utils";

type Message =
  | { role: "user"; content: string }
  | { role: "ai"; content: string; citations: ChatCitation[]; model: string }
  | { role: "error"; content: string };

const SAMPLE_QUESTIONS = [
  "When is my next appointment?",
  "What medications am I taking?",
  "Summarize my last visit",
];

function CitationLine({ c }: { c: ChatCitation }) {
  if (c.type === "section" && c.name) {
    const count = typeof c.count === "number" ? ` (${c.count})` : "";
    return (
      <li className="text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground/70">
          {c.name}
          {count}
        </span>
      </li>
    );
  }
  if (c.snippet) {
    return (
      <li className="text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground/70">
          {c.name ?? "From your records"}
        </span>
        <p className="italic mt-0.5 line-clamp-2">&ldquo;{c.snippet}&rdquo;</p>
      </li>
    );
  }
  return null;
}

function CitationList({ citations }: { citations: ChatCitation[] }) {
  const [open, setOpen] = useState(false);
  if (citations.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] text-primary hover:underline font-medium"
      >
        {open ? "Hide" : "Based on"} · {citations.length}
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 pl-2 border-l-2 border-primary/30">
          {citations.map((c, i) => (
            <CitationLine key={i} c={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AiBubble({
  content,
  citations,
}: {
  content: string;
  citations: ChatCitation[];
  model: string;
}) {
  return (
    <div className="flex gap-2 items-end">
      <div className="size-7 rounded-full bg-primary grid place-items-center shrink-0 text-white">
        <Sparkles className="size-3.5" />
      </div>
      <div className="max-w-[82%] min-w-0">
        <div className="rounded-2xl rounded-bl-md bg-white border border-border px-3.5 py-2.5 shadow-sm">
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {content}
          </p>
          <CitationList citations={citations} />
        </div>
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex gap-2 items-end justify-end">
      <div className="max-w-[82%]">
        <div className="rounded-2xl rounded-br-md bg-primary text-white px-3.5 py-2.5 text-sm leading-relaxed break-words shadow-sm">
          {content}
        </div>
      </div>
      <div className="size-7 rounded-full bg-secondary grid place-items-center shrink-0 text-muted-foreground">
        <User className="size-3.5" />
      </div>
    </div>
  );
}

function ErrorBubble({ content }: { content: string }) {
  return (
    <div className="flex gap-2 items-end">
      <div className="size-7 rounded-full bg-danger/15 grid place-items-center shrink-0 text-danger">
        <Sparkles className="size-3.5" />
      </div>
      <div className="max-w-[82%] rounded-2xl rounded-bl-md bg-danger/5 border border-danger/30 text-danger px-3.5 py-2.5 text-sm leading-relaxed">
        {content}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex gap-2 items-end">
      <div className="size-7 rounded-full bg-primary grid place-items-center shrink-0 text-white">
        <Sparkles className="size-3.5" />
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

export function ChatThread() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const mutation = useMutation({
    mutationFn: (question: string) => chatApi.ask(question),
    onSuccess: (data: ChatAnswer, question) => {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: question },
        {
          role: "ai",
          content: data.answer,
          citations: data.citations,
          model: data.model,
        },
      ]);
    },
    onError: (err, question) => {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: question },
        {
          role: "error",
          content:
            err instanceof Error
              ? err.message
              : "Something went wrong. Please try again.",
        },
      ]);
    },
  });

  const send = (questionOverride?: string) => {
    const q = (questionOverride ?? draft).trim();
    if (!q || mutation.isPending) return;
    setDraft("");
    mutation.mutate(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const isEmpty = messages.length === 0 && !mutation.isPending;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {isEmpty && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-4">
            <div className="size-12 rounded-2xl bg-primary grid place-items-center text-white shadow-md">
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

        {messages.map((msg, i) => {
          if (msg.role === "user")
            return <UserBubble key={i} content={msg.content} />;
          if (msg.role === "ai")
            return (
              <AiBubble
                key={i}
                content={msg.content}
                citations={msg.citations}
                model={msg.model}
              />
            );
          return <ErrorBubble key={i} content={msg.content} />;
        })}

        {mutation.isPending && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 mt-3 flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            rows={1}
            placeholder="Ask about your appointments, meds, or last visit…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={mutation.isPending}
            className={cn(
              "text-sm resize-none rounded-2xl border-border bg-white",
              "min-h-[40px] max-h-32 py-2.5 pl-3.5 pr-10",
            )}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={!draft.trim() || mutation.isPending}
            aria-label="Send"
            className={cn(
              "absolute right-1.5 bottom-1.5 size-8 rounded-full grid place-items-center transition",
              draft.trim() && !mutation.isPending
                ? "bg-primary text-white hover:brightness-105 shadow-sm"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            <Send className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
