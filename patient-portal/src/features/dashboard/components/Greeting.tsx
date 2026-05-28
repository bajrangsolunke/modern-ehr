import { timeOfDayGreeting } from "@/lib/utils";

export function Greeting({ firstName }: { firstName: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
        Good {timeOfDayGreeting()}, {firstName}
      </h1>
      <p className="text-muted">Here's what's happening with your care.</p>
    </div>
  );
}
