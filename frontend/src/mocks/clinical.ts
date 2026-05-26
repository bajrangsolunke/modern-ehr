import type { LabResult, Medication, SoapNote, TimelineEvent, VitalSign } from "@/types";

export const vitals: VitalSign[] = [
  { label: "Heart Rate", value: "72", unit: "bpm", trend: "flat", status: "normal" },
  { label: "Blood Pressure", value: "128/84", unit: "mmHg", trend: "up", status: "elevated" },
  { label: "SpO2", value: "97", unit: "%", trend: "flat", status: "normal" },
  { label: "Temperature", value: "36.8", unit: "°C", trend: "flat", status: "normal" },
  { label: "Respiration", value: "16", unit: "/min", trend: "down", status: "normal" },
  { label: "BMI", value: "27.4", unit: "", trend: "flat", status: "elevated" },
];

export const medications: Medication[] = [
  {
    id: "m-1",
    name: "Apixaban",
    dose: "5 mg",
    frequency: "BID",
    route: "Oral",
    startDate: "2025-04-20",
    status: "paused",
    prescriber: "Dr. Müller",
  },
  {
    id: "m-2",
    name: "Metformin",
    dose: "850 mg",
    frequency: "BID",
    route: "Oral",
    startDate: "2024-11-12",
    status: "active",
    prescriber: "Dr. Weber",
  },
  {
    id: "m-3",
    name: "Lisinopril",
    dose: "10 mg",
    frequency: "Daily",
    route: "Oral",
    startDate: "2024-03-05",
    status: "active",
    prescriber: "Dr. Müller",
  },
  {
    id: "m-4",
    name: "Atorvastatin",
    dose: "20 mg",
    frequency: "Nightly",
    route: "Oral",
    startDate: "2024-08-22",
    status: "active",
    prescriber: "Dr. Müller",
  },
];

export const labs: LabResult[] = [
  {
    id: "l-1",
    name: "Hemoglobin",
    value: "13.4",
    unit: "g/dL",
    range: "12.0–15.5",
    collectedAt: "2025-05-12",
  },
  {
    id: "l-2",
    name: "INR",
    value: "1.8",
    unit: "",
    range: "0.8–1.2",
    flag: "H",
    collectedAt: "2025-05-12",
  },
  {
    id: "l-3",
    name: "Creatinine",
    value: "0.94",
    unit: "mg/dL",
    range: "0.6–1.2",
    collectedAt: "2025-05-12",
  },
  {
    id: "l-4",
    name: "HbA1c",
    value: "7.8",
    unit: "%",
    range: "< 7.0",
    flag: "H",
    collectedAt: "2025-05-10",
  },
  {
    id: "l-5",
    name: "Potassium",
    value: "4.2",
    unit: "mmol/L",
    range: "3.5–5.1",
    collectedAt: "2025-05-12",
  },
];

export const soapNotes: SoapNote[] = [
  {
    id: "n-1",
    date: "2025-05-12T09:14",
    author: "Dr. Müller",
    version: 1,
    subjective:
      "Patient reports persistent right hip pain (7/10), worse with weight-bearing. Mild swelling. Denies fevers.",
    objective:
      "Vitals stable. Limited ROM in right hip. Trendelenburg sign positive. X-ray shows joint space narrowing.",
    assessment: "Advanced osteoarthritis right hip, conservative therapy failed.",
    plan: "Schedule total hip arthroplasty 15.05.2025. Pre-op labs and ECG. Pause apixaban 48h pre-op.",
    aiSummary:
      "Surgical candidate for THA. Anticoagulation bridge required. ICU bed recommended given ASA III + cardiac history.",
  },
];

export const timeline: TimelineEvent[] = [
  {
    id: "t-1",
    date: "2025-05-12",
    type: "lab",
    title: "Hb/INR collected",
    detail: "INR elevated at 1.8 — bridging plan applied.",
    author: "Lab",
  },
  {
    id: "t-2",
    date: "2025-05-10",
    type: "imaging",
    title: "Pelvis X-ray",
    detail: "Severe right hip joint space narrowing.",
    author: "Radiology",
  },
  {
    id: "t-3",
    date: "2025-05-05",
    type: "encounter",
    title: "Pre-anesthesia visit",
    detail: "ASA III. ICU bed flagged for post-op observation.",
    author: "Dr. Weber",
  },
  {
    id: "t-4",
    date: "2025-04-28",
    type: "note",
    title: "SOAP note created",
    detail: "Plan: schedule THA 15.05.2025.",
    author: "Dr. Müller",
  },
  {
    id: "t-5",
    date: "2025-04-20",
    type: "medication",
    title: "Apixaban paused",
    detail: "Bridging with LMWH initiated 48h pre-op.",
    author: "Pharmacy",
  },
];

export const checklist = [
  { id: "cl-1", label: "Case planning", completed: 8, total: 8, status: "done" },
  { id: "cl-2", label: "Diagnostics & Risk review", completed: 5, total: 5, status: "done" },
  { id: "cl-3", label: "Consent", completed: 5, total: 5, status: "done" },
  { id: "cl-4", label: "Anesthesia clearance", completed: 7, total: 7, status: "done" },
  { id: "cl-5", label: "Final surgical clearance", completed: 1, total: 7, status: "in-progress" },
];
