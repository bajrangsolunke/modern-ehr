import { Cloud } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

export function DemoBadge() {
  const demoModeActive = useAuthStore((s) => s.demoModeActive);
  if (!demoModeActive) return null;

  return (
    <div
      className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-warning/10 text-warning px-2.5 py-1 text-xs font-semibold"
      title="Backend unreachable — UI is reading from demo data"
    >
      <Cloud className="size-3" />
      Demo mode
    </div>
  );
}
