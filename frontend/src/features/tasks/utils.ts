import type {
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from "./api/tasks-api";

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  reminders: "Reminders",
  document: "Document",
  image_order: "Image Order",
  lab_order: "Lab Order",
  referral: "Referral",
  payment: "Payment",
  unsigned_encounter: "Unsigned Encounter",
  other: "Other",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const PRIORITY_TONE: Record<TaskPriority, string> = {
  low: "bg-success/10 text-success",
  medium: "bg-warning/10 text-warning",
  high: "bg-danger/10 text-danger",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  new: "New",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<TaskStatus, string> = {
  new: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  cancelled: "bg-muted text-muted-foreground",
};

export const CATEGORIES: TaskCategory[] = [
  "reminders",
  "document",
  "image_order",
  "lab_order",
  "referral",
  "payment",
  "unsigned_encounter",
  "other",
];

export const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

export const STATUSES: TaskStatus[] = [
  "new",
  "in_progress",
  "completed",
  "cancelled",
];

/** Short task-id label used in the table — "T 001", "T 023", etc.
 *  Derived from creation order is messy without a sequence; we use
 *  the last 3 hex chars of the UUID. Predictable, stable. */
export function taskIdLabel(id: string): string {
  const tail = id.replace(/-/g, "").slice(-3).toUpperCase();
  return `T ${tail}`;
}
