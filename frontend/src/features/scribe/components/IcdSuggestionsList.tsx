/**
 * ICD-10 suggestion list with Accept toggle, inline Edit, and Delete.
 */
import { useState } from "react";
import { CheckCircle2, Edit2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { usePatchIcd, useDeleteIcd } from "../hooks/use-scribe";
import type { ScribeIcdSuggestion } from "../api/scribe-api";

interface IcdSuggestionsListProps {
  sessionId: string;
  suggestions: ScribeIcdSuggestion[];
}

interface RowProps {
  sessionId: string;
  suggestion: ScribeIcdSuggestion;
}

function IcdRow({ sessionId, suggestion }: RowProps) {
  const patch = usePatchIcd(sessionId);
  const del = useDeleteIcd(sessionId);
  const [editing, setEditing] = useState(false);
  const [editCode, setEditCode] = useState(suggestion.code);
  const [editDesc, setEditDesc] = useState(suggestion.description);

  const confidencePct = Math.round(suggestion.confidence * 100);

  const handleAcceptToggle = () => {
    patch.mutate({
      icdId: suggestion.id,
      input: { accepted_by_user: !suggestion.acceptedByUser },
    });
  };

  const handleEditSave = () => {
    patch.mutate({
      icdId: suggestion.id,
      input: { code: editCode, description: editDesc },
    });
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-3 space-y-2 transition-colors",
        suggestion.acceptedByUser && "border-success/30 bg-success/5"
      )}
    >
      {editing ? (
        <div className="space-y-2">
          <Input
            value={editCode}
            onChange={(e) => setEditCode(e.target.value)}
            placeholder="ICD code"
            className="font-mono text-sm"
          />
          <Input
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="Description"
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="xs" onClick={handleEditSave} disabled={patch.isPending}>
              Save
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          {/* Accept checkbox */}
          <button
            type="button"
            onClick={handleAcceptToggle}
            disabled={patch.isPending}
            aria-label={suggestion.acceptedByUser ? "Unaccept" : "Accept ICD code"}
            className="mt-0.5 shrink-0"
          >
            <CheckCircle2
              className={cn(
                "size-5 transition-colors",
                suggestion.acceptedByUser
                  ? "text-success"
                  : "text-muted-foreground/30 hover:text-muted-foreground"
              )}
            />
          </button>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold font-mono">
                {suggestion.code}
              </span>
              <Badge variant="neutral" size="sm">
                {confidencePct}%
              </Badge>
              {suggestion.isValidated ? (
                <Badge variant="success" size="sm">
                  ✓ Validated
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  ⚠ Not in catalog
                </Badge>
              )}
            </div>
            <p className="text-sm text-foreground leading-snug">
              {suggestion.description}
            </p>
            {suggestion.reasoning && (
              <p className="text-xs text-muted-foreground leading-snug">
                {suggestion.reasoning}
              </p>
            )}
          </div>

          <div className="flex gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                setEditCode(suggestion.code);
                setEditDesc(suggestion.description);
                setEditing(true);
              }}
              aria-label="Edit ICD"
            >
              <Edit2 className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 hover:text-danger"
              onClick={() => del.mutate(suggestion.id)}
              disabled={del.isPending}
              aria-label="Delete ICD"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function IcdSuggestionsList({
  sessionId,
  suggestions,
}: IcdSuggestionsListProps) {
  if (suggestions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic text-center py-4">
        No ICD suggestions yet
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {suggestions.map((s) => (
        <IcdRow key={s.id} sessionId={sessionId} suggestion={s} />
      ))}
    </div>
  );
}
