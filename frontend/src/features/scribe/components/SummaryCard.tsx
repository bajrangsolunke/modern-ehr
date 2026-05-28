/**
 * Patient-facing visit summary — editable with debounced PATCH.
 * Offers copy-to-clipboard and PDF download.
 */
import { useEffect, useRef, useState } from "react";
import { Copy, Download, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { scribeApi } from "../api/scribe-api";
import { usePatchSummary } from "../hooks/use-scribe";

interface SummaryCardProps {
  sessionId: string;
  summary: string | null;
}

export function SummaryCard({ sessionId, summary }: SummaryCardProps) {
  const patch = usePatchSummary(sessionId);
  const [value, setValue] = useState(summary ?? "");
  const [downloading, setDownloading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (summary !== null) setValue(summary);
  }, [summary]);

  const handleChange = (v: string) => {
    setValue(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      patch.mutate(v);
    }, 300);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await scribeApi.downloadPdf(sessionId);
    } catch (err) {
      toast.error("PDF download failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDownloading(false);
    }
  };

  const disabled = summary === null;

  return (
    <div className="space-y-3">
      <Textarea
        rows={6}
        disabled={disabled}
        placeholder={disabled ? "Waiting for AI summary…" : "Visit summary…"}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="text-sm"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleCopy}
          disabled={disabled || !value}
        >
          <Copy className="size-3.5" />
          Copy
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          Download PDF
        </Button>
      </div>
    </div>
  );
}
