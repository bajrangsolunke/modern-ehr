/**
 * Seed conversations + messages for the Communication module. Drives
 * the in-memory Zustand store until the backend lands.
 */
import type { Conversation, Message, Participant } from "./types";

function todayAt(hh: number, mm: number): string {
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

function daysAgoAt(days: number, hh: number, mm: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

export const seedParticipants: Participant[] = [
  {
    id: "p-james",
    audience: "patient",
    name: "James Smith",
    mrn: "31455",
    dob: "1980-08-18",
    age: 45,
    gender: "Male",
    phone: "404-555-6574",
    email: "james@example.com",
    conditionTag: "diabetic",
  },
  {
    id: "p-james-2",
    audience: "patient",
    name: "James Smith",
    mrn: "31822",
    dob: "1974-02-09",
    age: 51,
    gender: "Male",
    phone: "404-555-2293",
    email: "j.smith@example.com",
    conditionTag: "cancer",
  },
  {
    id: "p-robert",
    audience: "patient",
    name: "Robert Brown",
    mrn: "31901",
    dob: "1969-11-04",
    age: 56,
    gender: "Male",
    phone: "404-555-9088",
    email: "robert.brown@example.com",
    conditionTag: "asthma",
  },
  {
    id: "p-maria",
    audience: "patient",
    name: "Maria Johnson",
    mrn: "32007",
    dob: "1991-03-22",
    age: 34,
    gender: "Female",
    phone: "404-555-2310",
    email: "maria.j@example.com",
    conditionTag: "mental",
  },
  {
    id: "p-laura",
    audience: "patient",
    name: "Laura Wilson",
    mrn: "32118",
    dob: "1956-07-30",
    age: 69,
    gender: "Female",
    phone: "404-555-7782",
    email: "laura.wilson@example.com",
    conditionTag: "bp",
  },
  // Clinicians
  {
    id: "c-leslie",
    audience: "clinician",
    name: "Dr. Leslie Alexander",
    email: "leslie@padmavat.health",
    role: "provider",
    specialty: "Orthopedic Surgeon",
  },
  {
    id: "c-jane",
    audience: "clinician",
    name: "Dr. Jane Cooper",
    email: "jane@padmavat.health",
    role: "provider",
    specialty: "Anesthesiologist",
  },
  {
    id: "c-ralph",
    audience: "clinician",
    name: "Ralph Edwards",
    email: "ralph@padmavat.health",
    role: "staff",
    specialty: "Care coordinator",
  },
];

export const seedConversations: Conversation[] = [
  {
    id: "conv-1",
    audience: "patient",
    participant: seedParticipants[0]!,
    lastMessage: "Hi, I wanted to confirm my appointment for next Monday.",
    lastMessageAt: todayAt(9, 15),
    unread: 1,
  },
  {
    id: "conv-2",
    audience: "patient",
    participant: seedParticipants[1]!,
    lastMessage: "Yes, please give me some time I'll check and let you know.",
    lastMessageAt: todayAt(11, 31),
    unread: 0,
  },
  {
    id: "conv-3",
    audience: "patient",
    participant: seedParticipants[2]!,
    lastMessage: "Good afternoon, I am reaching out to ask about my inhaler refill.",
    lastMessageAt: daysAgoAt(3, 9, 45),
    unread: 0,
  },
  {
    id: "conv-4",
    audience: "patient",
    participant: seedParticipants[3]!,
    lastMessage: "Hello, I would like to inquire about the care plan we discussed.",
    lastMessageAt: daysAgoAt(3, 9, 30),
    unread: 0,
  },
  {
    id: "conv-5",
    audience: "patient",
    participant: seedParticipants[4]!,
    lastMessage: "My BP reading this morning was 142/91 — should I be worried?",
    lastMessageAt: daysAgoAt(5, 18, 12),
    unread: 1,
  },
  {
    id: "conv-c1",
    audience: "clinician",
    participant: seedParticipants[5]!,
    lastMessage: "Can you cover Tuesday's pre-op clinic? I have a conflict.",
    lastMessageAt: todayAt(8, 4),
    unread: 1,
  },
  {
    id: "conv-c2",
    audience: "clinician",
    participant: seedParticipants[6]!,
    lastMessage: "Anesthesia plan attached for the 10 AM case.",
    lastMessageAt: daysAgoAt(1, 7, 50),
    unread: 0,
  },
  {
    id: "conv-c3",
    audience: "clinician",
    participant: seedParticipants[7]!,
    lastMessage: "Care plan PDFs are uploaded to the patient charts you flagged.",
    lastMessageAt: daysAgoAt(2, 14, 22),
    unread: 0,
  },
];

export const seedMessages: Message[] = [
  // James Smith (diabetic)
  {
    id: "m-1-1",
    conversationId: "conv-1",
    authorId: "p-james",
    direction: "incoming",
    body: "Hi, I wanted to confirm my appointment for next Monday — does the original 9:30 AM slot still work?",
    sentAt: todayAt(9, 15),
  },
  // James Smith (cancer)
  {
    id: "m-2-1",
    conversationId: "conv-2",
    authorId: "p-james-2",
    direction: "incoming",
    body: "Hi can you please tell me if there is any slot available for tomorrow?",
    sentAt: todayAt(17, 5),
  },
  {
    id: "m-2-2",
    conversationId: "conv-2",
    authorId: "me",
    direction: "outgoing",
    body: "Yes, please give me some time I'll check and let you know.",
    sentAt: todayAt(17, 1),
  },
  // Robert Brown (asthma)
  {
    id: "m-3-1",
    conversationId: "conv-3",
    authorId: "p-robert",
    direction: "incoming",
    body: "Good afternoon, I am reaching out to ask about my inhaler refill — I'm down to about a week.",
    sentAt: daysAgoAt(3, 9, 45),
  },
  // Maria Johnson (mental)
  {
    id: "m-4-1",
    conversationId: "conv-4",
    authorId: "p-maria",
    direction: "incoming",
    body: "Hello, I would like to inquire about the care plan we discussed last visit.",
    sentAt: daysAgoAt(3, 9, 30),
  },
  // Laura Wilson (BP)
  {
    id: "m-5-1",
    conversationId: "conv-5",
    authorId: "p-laura",
    direction: "incoming",
    body: "My BP reading this morning was 142/91 — should I be worried? I took my medication on time.",
    sentAt: daysAgoAt(5, 18, 12),
  },
  // Clinician threads
  {
    id: "m-c1-1",
    conversationId: "conv-c1",
    authorId: "c-leslie",
    direction: "incoming",
    body: "Can you cover Tuesday's pre-op clinic? I have a conflict.",
    sentAt: todayAt(8, 4),
  },
  {
    id: "m-c2-1",
    conversationId: "conv-c2",
    authorId: "c-jane",
    direction: "incoming",
    body: "Anesthesia plan attached for the 10 AM case. Let me know if you have any concerns.",
    sentAt: daysAgoAt(1, 7, 50),
  },
  {
    id: "m-c3-1",
    conversationId: "conv-c3",
    authorId: "c-ralph",
    direction: "incoming",
    body: "Care plan PDFs are uploaded to the patient charts you flagged — Emma Johnson and Jacob Miller.",
    sentAt: daysAgoAt(2, 14, 22),
  },
];
