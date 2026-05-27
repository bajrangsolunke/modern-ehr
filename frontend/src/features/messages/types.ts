/**
 * Communication feature types (US-COMM-1..5). UI-only today; the
 * backend contract (`conversations`, `messages` tables, WS endpoints)
 * lands in the next phase.
 */

export type Audience = "patient" | "clinician";

export type ConditionTag =
  | "diabetic"
  | "asthma"
  | "cancer"
  | "bp"
  | "mental";

export interface Participant {
  id: string;
  audience: Audience;
  name: string;
  /** Optional profile photo. */
  avatarUrl?: string;
  /** Clinical context — only set for patient participants. */
  mrn?: string;
  dob?: string;
  age?: number;
  gender?: "Male" | "Female" | "Other";
  phone?: string;
  email?: string;
  /** For clinicians. */
  role?: "provider" | "staff" | "admin";
  specialty?: string;
  /** First match wins for filter chips. */
  conditionTag?: ConditionTag;
  /** When this participant last read the thread (ISO). Drives read
   *  receipts on the other side's outgoing bubbles. */
  lastReadAt?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  authorId: string;
  /** "incoming" = from the other side, "outgoing" = from the current user. */
  direction: "incoming" | "outgoing";
  body: string;
  /** ISO timestamp. */
  sentAt: string;
  urgent?: boolean;
}

export interface Conversation {
  id: string;
  audience: Audience;
  participant: Participant;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
}
