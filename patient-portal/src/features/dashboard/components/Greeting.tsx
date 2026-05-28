import { timeOfDayGreeting } from "@/lib/utils";

export function Greeting({ firstName }: { firstName: string }) {
  return (
    <div className="space-y-1">
      <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        Good {timeOfDayGreeting()}, {firstName}
      </h1>
      <p className="text-sm text-muted-foreground">
        Here's what's happening with your care today.
      </p>
    </div>
  );
}
