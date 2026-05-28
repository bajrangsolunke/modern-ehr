/**
 * Aggregates per-patient clinical events into a single chronological
 * timeline. v1 sources: SOAP notes + medications. Labs and imaging will
 * slot in once those have first-class hooks.
 *
 * The hook is composed of the existing per-resource hooks — that means
 * one fewer endpoint to maintain and the timeline always stays in sync
 * with the lists those hooks already power.
 */
import { useMemo } from "react";
import { useNotes } from "./use-notes";
import { useMedications } from "./use-medications";
import type { TimelineEvent } from "@/types";

export function useTimeline(patientId: string | undefined) {
  const notes = useNotes(patientId);
  const medications = useMedications(patientId);

  const events = useMemo<TimelineEvent[]>(() => {
    const out: TimelineEvent[] = [];

    for (const n of notes.data ?? []) {
      const headline =
        (n.assessment || n.subjective || n.objective || n.plan || "")
          .split(/\s+/)
          .slice(0, 18)
          .join(" ");
      out.push({
        id: `note-${n.id}`,
        date: n.date,
        type: "note",
        title: "SOAP note",
        detail: headline || "Clinical note recorded",
        author: n.author || undefined,
      });
    }

    for (const m of medications.data ?? []) {
      if (!m.startDate) continue;
      out.push({
        id: `med-${m.id}`,
        date: m.startDate,
        type: "medication",
        title: `Started ${m.name}`,
        detail: [m.dose, m.frequency, m.route].filter(Boolean).join(" · "),
        author: m.prescriber || undefined,
      });
    }

    // Newest first — clinicians scan top-to-bottom.
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return out;
  }, [notes.data, medications.data]);

  return {
    events,
    isLoading: notes.isLoading || medications.isLoading,
    isError: notes.isError || medications.isError,
  };
}
