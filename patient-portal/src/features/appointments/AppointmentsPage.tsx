import { CalendarClock, Loader2, MapPin } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SortableTh, TABLE_ROW_BG } from "@/components/ui/sortable-th";
import { SummaryTile } from "@/components/ui/summary-tile";
import { useAppointments } from "./hooks/use-appointments";
import { humanWhen } from "@/lib/datetime";
import type { PatientAppointment } from "./api/appointments-api";

const STATUS_VARIANT: Record<
  string,
  "info" | "success" | "warning" | "neutral" | "danger"
> = {
  scheduled: "info",
  confirmed: "success",
  pending: "warning",
  completed: "neutral",
  cancelled: "danger",
  "no-show": "danger",
};

function typeLabel(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1).replace("-", " ");
}

export function AppointmentsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useAppointments();

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Upcoming and past visits with your care team."
      />

      {!isLoading && !isError && data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:gap-3 mb-3">
          <SummaryTile
            label="Upcoming"
            value={data.upcoming.length}
            icon={<CalendarClock />}
            tone="primary"
          />
          <SummaryTile
            label="Past"
            value={data.past.length}
            icon={<CalendarClock />}
            tone="neutral"
          />
          <SummaryTile
            label="Total"
            value={data.upcoming.length + data.past.length}
            icon={<CalendarClock />}
            tone="info"
          />
        </div>
      )}

      {isLoading && (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load appointments"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-6">
          <AppointmentsSection
            title="Upcoming"
            items={data.upcoming}
            emptyHint="When your provider schedules a visit, it'll appear here."
          />

          {data.past.length > 0 && (
            <AppointmentsSection
              title="Past"
              items={data.past}
              emptyHint=""
            />
          )}
        </div>
      )}
    </>
  );
}

function AppointmentsSection({
  title,
  items,
  emptyHint,
}: {
  title: string;
  items: PatientAppointment[];
  emptyHint: string;
}) {
  if (items.length === 0) {
    if (!emptyHint) return null;
    return (
      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          {title}
        </h2>
        <Empty
          icon={<CalendarClock className="size-5" />}
          title={`No ${title.toLowerCase()} appointments`}
          description={emptyHint}
        />
      </section>
    );
  }
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {title} · {items.length}
      </h2>
      <Card className="overflow-hidden p-3 sm:p-4">
        <div className="overflow-x-auto">
          <table
            className="w-full text-sm border-separate"
            style={{ borderSpacing: "0 6px" }}
          >
            <thead>
              <tr className="text-xs text-muted-foreground text-left">
                <SortableTh first>When</SortableTh>
                <SortableTh>Type</SortableTh>
                <SortableTh>Provider</SortableTh>
                <SortableTh>Where</SortableTh>
                <SortableTh last>Status</SortableTh>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <AppointmentRow key={a.id} appt={a} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function AppointmentRow({ appt }: { appt: PatientAppointment }) {
  return (
    <tr className="hover:[&_td]:bg-[#EEF2F8] transition">
      <td
        className="px-4 py-2 first:rounded-l-full"
        style={{ background: TABLE_ROW_BG }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <CalendarClock className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold tabular-nums truncate">
              {humanWhen(appt.starts_at)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {appt.duration_minutes} min
              {appt.reason ? ` · ${appt.reason}` : ""}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2 text-foreground/80" style={{ background: TABLE_ROW_BG }}>
        {typeLabel(appt.type)}
      </td>
      <td className="px-4 py-2 text-foreground/80" style={{ background: TABLE_ROW_BG }}>
        {appt.provider_name ?? (
          <span className="text-muted-foreground italic">—</span>
        )}
        {appt.provider_specialty && (
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {appt.provider_specialty}
          </div>
        )}
      </td>
      <td className="px-4 py-2" style={{ background: TABLE_ROW_BG }}>
        {appt.room ? (
          <span className="inline-flex items-center gap-1.5 text-foreground/80">
            <MapPin className="size-3.5 text-muted-foreground" />
            {appt.room}
          </span>
        ) : (
          <span className="text-muted-foreground italic">—</span>
        )}
      </td>
      <td
        className="px-4 py-2 last:rounded-r-full"
        style={{ background: TABLE_ROW_BG }}
      >
        <Badge variant={STATUS_VARIANT[appt.status] ?? "neutral"} size="sm">
          {appt.status}
        </Badge>
      </td>
    </tr>
  );
}
