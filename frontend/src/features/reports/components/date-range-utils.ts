import type { DateRange } from "./DateRangeFilter";

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Returns the default last-30-days range. */
export function defaultRange(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return { start: toISO(start), end: toISO(end) };
}
