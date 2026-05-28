import { useCallback, useEffect, useState } from "react";
import { Sparkles, Loader2, RotateCw } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  conversationId: string;
  onPick: (text: string) => void;
}

interface SuggestResponse {
  suggestions: string[];
}

/**
 * Inline panel above the composer that asks the backend for 2-3 short
 * reply drafts. Refetches when the conversation changes. Clicking a
 * suggestion seeds the composer textarea — the patient still has to
 * hit send.
 */
export function AiSuggestions({ conversationId, onPick }: Props) {
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<SuggestResponse>(
        `/patient-portal/me/conversations/${conversationId}/ai-suggest`
      );
      setItems(res.suggestions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load suggestions");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="border-t border-border bg-secondary/40 px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-primary">
          <Sparkles className="size-3.5" />
          AI suggestions
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={load}
          disabled={loading}
          aria-label="Refresh suggestions"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RotateCw className="size-3.5" />
          )}
        </Button>
      </div>

      {error && !loading && (
        <p className="text-xs text-danger">{error}</p>
      )}

      {!error && items.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground">
          No suggestions yet. Try refreshing.
        </p>
      )}

      <div className={cn("flex flex-wrap gap-2", loading && "opacity-60")}>
        {items.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(s)}
            className="text-left rounded-2xl bg-white border border-border shadow-soft px-3 py-2 text-xs text-foreground hover:border-primary/40 hover:text-primary transition-colors max-w-full"
          >
            {s}
          </button>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground mt-2 italic">
        AI suggestions are drafts. Review before sending.
      </p>
    </div>
  );
}
