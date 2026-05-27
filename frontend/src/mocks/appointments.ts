import type { Appointment } from "@/types";

export const appointments: Appointment[] = [
  {
    id: "ap-1",
    patientId: "p-1009",
    patientName: "Jane Cooper",
    type: "consultation",
    status: "confirmed",
    date: "Mar 22",
    time: "10:00 AM",
    duration: 30,
    physician: "Dr. Robert Fox", startsAt: new Date().toISOString(),
  },
  {
    id: "ap-2",
    patientId: "p-1003",
    patientName: "Guy Hawkins",
    type: "diagnosis",
    status: "confirmed",
    date: "Mar 22",
    time: "11:00 AM",
    duration: 45,
    physician: "Dr. Robert Fox", startsAt: new Date().toISOString(),
  },
  {
    id: "ap-3",
    patientId: "p-1008",
    patientName: "Cameron Williamson",
    type: "surgery",
    status: "confirmed",
    date: "Mar 22",
    time: "12:30 PM",
    duration: 120,
    physician: "Dr. Robert Fox", startsAt: new Date().toISOString(),
    room: "OR-04",
  },
  {
    id: "ap-4",
    patientId: "p-1005",
    patientName: "Jerome Bell",
    type: "consultation",
    status: "confirmed",
    date: "Mar 22",
    time: "3:00 PM",
    duration: 30,
    physician: "Dr. Robert Fox", startsAt: new Date().toISOString(),
  },
  {
    id: "ap-5",
    patientId: "p-1012",
    patientName: "Dianne Russell",
    type: "biopsy",
    status: "cancelled",
    date: "Mar 22",
    time: "3:40 PM",
    duration: 60,
    physician: "Dr. Robert Fox", startsAt: new Date().toISOString(),
  },
];

export const teamGantt = [
  {
    name: "Dr. Leslie Alexander",
    role: "Orthopedic surgeon",
    blocks: [
      { start: 9, end: 11, type: "surgery", label: "Surgery" },
      { start: 11.5, end: 12, type: "break", label: "Br." },
      { start: 12, end: 13, type: "consent", label: "Consent talk" },
      { start: 14, end: 15, type: "ward", label: "Ward round" },
    ],
  },
  {
    name: "Dr. Jane Cooper",
    role: "Anesthesiologist",
    blocks: [
      { start: 9, end: 10.5, type: "consent", label: "Consent talk" },
      { start: 10.5, end: 12, type: "ward", label: "Ward round" },
      { start: 13, end: 14, type: "break", label: "Br." },
      { start: 14, end: 16, type: "consent", label: "Consent talk" },
    ],
  },
  {
    name: "Dr. Wade Warren",
    role: "Physiotherapist",
    blocks: [
      { start: 9.5, end: 11.5, type: "ward", label: "Ward round" },
      { start: 12, end: 13, type: "consent", label: "Consent talk" },
    ],
  },
  {
    name: "Dr. Esther Howard",
    role: "Orthopedic oncologist",
    blocks: [
      { start: 10, end: 13, type: "surgery", label: "Surgery" },
      { start: 14, end: 15, type: "break", label: "Br." },
    ],
  },
  {
    name: "Dr. Cameron Williamson",
    role: "Radiologist",
    blocks: [
      { start: 9, end: 11, type: "consent", label: "Consent talk" },
      { start: 13, end: 15, type: "surgery", label: "Surgery" },
    ],
  },
];
