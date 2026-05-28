function timeOfDay(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

export function Greeting({ firstName }: { firstName: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-[28px] lg:text-[32px] font-bold tracking-tight leading-tight">
        Good {timeOfDay()}, {firstName}
      </h1>
      <p className="text-sm text-muted-foreground">
        Here's what's happening with your care today.
      </p>
    </div>
  );
}
