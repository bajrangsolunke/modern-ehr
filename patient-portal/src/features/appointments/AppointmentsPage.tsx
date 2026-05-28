import { CalendarClock, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Empty } from "@/components/ui/empty";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useAppointments } from "./hooks/use-appointments";
import { AppointmentRow } from "./components/AppointmentRow";

export function AppointmentsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useAppointments();

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Upcoming and past visits with your care team."
      />

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
        <div className="max-w-3xl space-y-8">
          <section className="space-y-3">
            <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Upcoming · {data.upcoming.length}
            </h2>
            {data.upcoming.length === 0 ? (
              <Empty
                icon={<CalendarClock className="size-5" />}
                title="No upcoming appointments"
                description="When your provider schedules a visit, it'll appear here."
              />
            ) : (
              <div className="space-y-3">
                {data.upcoming.map((a) => (
                  <AppointmentRow key={a.id} appt={a} />
                ))}
              </div>
            )}
          </section>

          {data.past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Past · {data.past.length}
              </h2>
              <div className="space-y-3">
                {data.past.map((a) => (
                  <AppointmentRow key={a.id} appt={a} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
