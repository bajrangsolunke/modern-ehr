import { CalendarPlus, Filter } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { UpcomingAppointments } from "@/features/dashboard/components/UpcomingAppointments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const stats = [
  { label: "Today", value: 12, sub: "8 confirmed" },
  { label: "This week", value: 64, sub: "5 pending" },
  { label: "Cancellations", value: 3, sub: "vs 7 last week", positive: true },
  { label: "No-shows", value: 2, sub: "−40%", positive: true },
];

export function AppointmentsPage() {
  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Today · Apr 03, 2025"
        right={
          <>
            <Button variant="secondary"><Filter className="size-4"/>Filter</Button>
            <Button><CalendarPlus className="size-4"/>New appointment</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="mt-2 text-3xl font-bold">{s.value}</div>
              <Badge
                variant={s.positive ? "success" : "default"}
                size="sm"
                className="mt-2"
              >
                {s.sub}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <UpcomingAppointments />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Scheduling AI tips</CardTitle>
          </CardHeader>
          <CardContent className="pb-5 space-y-3 text-sm">
            <Tip text="Patient Dianne Russell consistently no-shows Wednesday slots — try Friday." />
            <Tip text="OR-04 has a 12-min average overrun. Buffer downstream consults by 15 min." />
            <Tip text="Dr. Wright is overbooked next week — shift 3 follow-ups to Dr. Adams." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Pending requests</CardTitle>
          </CardHeader>
          <CardContent className="pb-5 space-y-3 text-sm">
            <Request name="Marvin McKinney" reason="Follow-up · post-op week 2"/>
            <Request name="Brooklyn Simmons" reason="New consult · Knee pain"/>
            <Request name="Robert Fox" reason="Imaging review"/>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <div className="flex gap-2 items-start p-3 rounded-xl bg-surface-subtle">
      <span className="text-primary text-lg leading-none">✨</span>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Request({ name, reason }: { name: string; reason: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-subtle p-3">
      <div>
        <div className="font-semibold">{name}</div>
        <div className="text-xs text-muted-foreground">{reason}</div>
      </div>
      <div className="flex gap-1">
        <Button size="xs" variant="secondary">Decline</Button>
        <Button size="xs">Accept</Button>
      </div>
    </div>
  );
}
