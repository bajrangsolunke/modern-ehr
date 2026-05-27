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

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  hasPreview: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  /** Author identity. Exactly one is set:
   *   - senderUserId for staff-sent messages
   *   - senderPatientId for patient-sent (Twilio SMS-in, future)
   *  Whether the message renders "outgoing" or "incoming" is decided
   *  at render time by comparing senderUserId to the current viewer. */
  senderUserId: string | null;
  senderPatientId: string | null;
  body: string;
  /** ISO timestamp. */
  sentAt: string;
  urgent?: boolean;
  attachments?: Attachment[];
}

export interface Conversation {
  id: string;
  audience: Audience;
  participant: Participant;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
}
