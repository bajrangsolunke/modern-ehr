import { useAuthStore } from "@/stores/auth-store";

function timeOfDay(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

export function Greeting({ firstName }: { firstName: string }) {
  const me = useAuthStore((s) => s.me);
  const name = firstName || me?.first_name || "there";
  return (
    <div className="space-y-1 mb-6 lg:mb-8">
      <h1 className="text-[28px] lg:text-[32px] font-bold tracking-tight leading-tight">
        Good {timeOfDay()}, {name}
      </h1>
      <p className="text-sm text-muted-foreground">
        Here's what's happening with your care today.
      </p>
    </div>
  );
}
