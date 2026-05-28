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

export function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}
