import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeOfDayGreeting(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

export function humanWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const diffDays = Math.round(
    (d.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000
  );
  const d2 = new Date(iso);
  const time = d2.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (diffDays === 0) return `Today at ${time}`;
  if (diffDays === 1) return `Tomorrow at ${time}`;
  if (diffDays > 1 && diffDays < 7) {
    return `${d2.toLocaleDateString("en-US", { weekday: "long" })} at ${time}`;
  }
  return `${d2.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} at ${time}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
