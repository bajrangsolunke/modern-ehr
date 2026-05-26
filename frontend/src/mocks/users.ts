import type { User } from "@/types";

export const currentUser: User = {
  id: "u-001",
  name: "Dr. Robert Fox",
  email: "robert.fox@padmavat.health",
  role: "surgeon",
  specialty: "Orthopedics & Trauma Surgery",
};

export const team: User[] = [
  {
    id: "u-002",
    name: "Dr. Leslie Alexander",
    email: "leslie@padmavat.health",
    role: "physician",
    specialty: "Orthopedic Surgeon",
  },
  {
    id: "u-003",
    name: "Dr. Jane Cooper",
    email: "jane@padmavat.health",
    role: "physician",
    specialty: "Anesthesiologist",
  },
  {
    id: "u-004",
    name: "Dr. Wade Warren",
    email: "wade@padmavat.health",
    role: "physician",
    specialty: "Physiotherapist",
  },
  {
    id: "u-005",
    name: "Dr. Esther Howard",
    email: "esther@padmavat.health",
    role: "physician",
    specialty: "Orthopedic Oncologist",
  },
  {
    id: "u-006",
    name: "Dr. Cameron Williamson",
    email: "cameron@padmavat.health",
    role: "physician",
    specialty: "Radiologist",
  },
];
