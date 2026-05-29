/**
 * PatientChatThread — scrollable message list + composer for the patient Q&A chatbot.
 *
 * Renders user messages, AI answers with citations, and errors.
 * Composer is a Textarea + Send button. Chips provide sample questions.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { patientsAiApi, type ChatCitation } from "@/features/patients/api/ai-api";

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

type Message =
  | { role: "user"; content: string; ts: string }
  | { role: "ai"; content: string; citations: ChatCitation[]; model: string; ts: string }
  | { role: "error"; content: string; ts: string };

// ---------------------------------------------------------------------------
// Sample questions
// ---------------------------------------------------------------------------

const SAMPLE_QUESTIONS = [
  "What were the last lab results?",
  "Summarize recent SOAP notes",
  "Any allergies or anticoagulants to flag?",
];

// ---------------------------------------------------------------------------
// Citation display
// ---------------------------------------------------------------------------

function CitationItem({ c }: { c: ChatCitation }) {
  const hasKnownFields = c.type || c.ref_id || c.snippet;
  if (!hasKnownFields) {
    return (
      <li className="text-xs text-muted-foreground font-mono break-all">
        {JSON.stringify(c)}
      </li>
    );
  }
  return (
    <li className="text-xs text-muted-foreground space-y-0.5">
      {(c.type || c.ref_id) && (
        <span className="font-semibold text-foreground/70">
          {[c.type, c.ref_id].filter(Boolean).join(" · ")}
        </span>
      )}
      {c.snippet && <p className="italic">&ldquo;{c.snippet}&rdquo;</p>}
    </li>
  );
}

// ---------------------------------------------------------------------------
// AI message
// ---------------------------------------------------------------------------

function AiMessage({
  content,
  citations,
  model,
}: {
  content: string;
  citations: ChatCitation[];
  model: string;
}) {
  const [citationsOpen, setCitationsOpen] = useState(false);

  return (
    <div className="flex gap-2.5">
      <div className="size-7 rounded-full bg-primary/10 grid place-items-center shrink-0 mt-0.5">
        <Sparkles className="size-3.5 text-primary" />
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider">
            {model}
          </span>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        {citations.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setCitationsOpen((v) => !v)}
              className="text-xs text-primary hover:underline font-medium"
            >
              {citationsOpen ? "Hide" : "Show"} sources ({citations.length})
            </button>
            {citationsOpen && (
              <ul className="mt-1.5 space-y-1.5 pl-2 border-l-2 border-border">
                {citations.map((c, i) => (
                  <CitationItem key={i} c={c} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  patientId: string;
}

export function PatientChatThread({ patientId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const mutation = useMutation({
    mutationFn: (question: string) =>
      patientsAiApi.ask({ question, patientId }),
    onSuccess: (data, question) => {
      const ts = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        { role: "user", content: question, ts },
        {
          role: "ai",
          content: data.answer,
          citations: data.citations,
          model: data.model,
          ts,
        },
      ]);
    },
    onError: (err, question) => {
      const ts = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        { role: "user", content: question, ts },
        {
          role: "error",
          content: err instanceof Error ? err.message : "Something went wrong.",
          ts,
        },
      ]);
    },
  });

  const send = () => {
    const q = draft.trim();
    if (!q || mutation.isPending) return;
    setDraft("");
    mutation.mutate(q);
  };

  const fillChip = (q: string) => {
    setDraft(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Message thread */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ask anything about this patient&apos;s chart. e.g.:
            </p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => fillChip(q)}
                  className="text-xs border border-border rounded-full px-3 py-1.5 bg-white hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
                  {msg.content}
                </div>
              </div>
            );
          }
          if (msg.role === "ai") {
            return (
              <AiMessage
                key={i}
                content={msg.content}
                citations={msg.citations}
                model={msg.model}
              />
            );
          }
          // error
          return (
            <div
              key={i}
              className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700"
            >
              {msg.content}
            </div>
          );
        })}

        {mutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Thinking…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="mt-4 flex gap-2 items-end shrink-0">
        <Textarea
          rows={2}
          placeholder="Ask a question…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-sm resize-none"
          disabled={mutation.isPending}
        />
        <Button
          type="button"
          size="icon"
          onClick={send}
          disabled={!draft.trim() || mutation.isPending}
          aria-label="Send"
          className="shrink-0"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
