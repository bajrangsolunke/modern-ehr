/**
 * In-Overview AI clinical summary card. Auto-fetches via useChartAi
 * (same query the chip in the header uses, so they share one network
 * call per chart open). Regenerate hits the server with ?force=true;
 * Copy-to-note copies the summary to the clipboard; Open SOAP swaps
 * to the Clinical notes tab via the parent's onOpenSoap callback.
 */
import { Loader2, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";
import { useChartAi, useRegenerateSummary } from "../hooks/use-chart-ai";

interface Props {
  patientId: string;
  /** Switch to the Clinical notes tab from this card. */
  onOpenSoap?: () => void;
}

export function AiSummary({ patientId, onOpenSoap }: Props) {
  const { data, isLoading, isError } = useChartAi(patientId);
  const regen = useRegenerateSummary(patientId);

  const summary = data?.summary;

  const copyToNote = async () => {
    if (!summary?.summary) return;
    try {
      await navigator.clipboard.writeText(
        summary.bullets.length
          ? `${summary.summary}\n\n${summary.bullets.map((b) => `• ${b}`).join("\n")}`
          : summary.summary
      );
      toast.success("Summary copied to clipboard");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="relative overflow-hidden border-primary/30">
        <div className="absolute -top-12 -right-12 size-40 rounded-full bg-primary/20 blur-3xl" />
        <CardContent className="p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-primary-gradient grid place-items-center text-white">
                <Sparkles className="size-3.5" />
              </div>
              <h3 className="font-semibold text-sm">AI clinical summary</h3>
              <Badge variant="default" size="sm">Beta</Badge>
              {summary && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  · {summary.model} · {Math.round(summary.confidence * 100)}% confidence
                  {summary.cached && " · cached"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="size-7" disabled>
                <ThumbsUp className="size-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="size-7" disabled>
                <ThumbsDown className="size-3.5" />
              </Button>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Generating clinical summary…
            </div>
          )}

          {isError && !isLoading && (
            <p className="text-sm text-muted-foreground">
              AI summary unavailable. Try Regenerate.
            </p>
          )}

          {summary && !isLoading && (
            <>
              <p className="text-sm leading-relaxed text-foreground/80">
                {summary.summary}
              </p>
              {summary.bullets.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {summary.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2 leading-snug">
                      <span className="mt-1.5 size-1 rounded-full shrink-0 bg-muted-foreground" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <div className="mt-3 flex gap-1.5 flex-wrap">
            <Button
              size="xs"
              variant="soft"
              onClick={() => regen.mutate()}
              disabled={regen.isPending}
            >
              {regen.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : null}
              Regenerate
            </Button>
            <Button size="xs" variant="soft" onClick={onOpenSoap} disabled={!onOpenSoap}>
              Open SOAP
            </Button>
            <Button size="xs" variant="soft" onClick={copyToNote} disabled={!summary}>
              Copy to note
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
