import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  MapPin,
  Receipt,
  Stethoscope,
  Video,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SortableTh, TABLE_ROW_BG } from "@/components/ui/sortable-th";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAppointments } from "./hooks/use-appointments";
import { humanWhen } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { PatientAppointment } from "./api/appointments-api";
import { PayInvoiceModal } from "@/features/billing/components/PayInvoiceModal";
import type { Invoice } from "@/features/billing/api/billing-api";

type View = "cards" | "list";

const STATUS_VARIANT: Record<
  string,
  "info" | "success" | "warning" | "neutral" | "danger" | "default"
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

/**
 * Returns true when the appointment is within the join window:
 * 10 minutes before start through 60 minutes after start, the
 * status allows joining, and the appointment is a virtual visit.
 * In-person visits never show the Join button.
 */
function isJoinable(appt: PatientAppointment): boolean {
  if (appt.modality !== "virtual") return false;
  const blocked = new Set(["completed", "cancelled", "no-show"]);
  if (blocked.has(appt.status)) return false;
  const now = Date.now();
  const start = new Date(appt.starts_at).getTime();
  if (Number.isNaN(start)) return false;
  return start - now <= 10 * 60_000 && now - start <= 60 * 60_000;
}

export function AppointmentsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useAppointments();
  const [view, setView] = useState<View>("cards");

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Upcoming and past visits with your care team."
        right={<ViewToggle mode={view} onChange={setView} />}
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
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">
              Upcoming · {data.upcoming.length}
            </TabsTrigger>
            <TabsTrigger value="past">Past · {data.past.length}</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            <AppointmentsSection
              items={data.upcoming}
              view={view}
              emptyTitle="No upcoming appointments"
              emptyHint="When your provider schedules a visit, it'll appear here."
            />
          </TabsContent>

          <TabsContent value="past">
            <AppointmentsSection
              items={data.past}
              view={view}
              emptyTitle="No past appointments"
              emptyHint="Your visit history will appear here."
            />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

function ViewToggle({
  mode,
  onChange,
}: {
  mode: View;
  onChange: (m: View) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-[#F1F4F9] p-1">
      <ToggleBtn active={mode === "cards"} onClick={() => onChange("cards")}>
        <LayoutGrid className="size-4" />
        Cards
      </ToggleBtn>
      <ToggleBtn active={mode === "list"} onClick={() => onChange("list")}>
        <ListIcon className="size-4" />
        List
      </ToggleBtn>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-semibold transition ring-focus",
        active
          ? "bg-slate-900 text-white shadow-soft"
          : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
      )}
    >
      {children}
    </button>
  );
}

function AppointmentsSection({
  items,
  view,
  emptyTitle,
  emptyHint,
}: {
  items: PatientAppointment[];
  view: View;
  emptyTitle: string;
  emptyHint: string;
}) {
  if (items.length === 0) {
    return (
      <Empty
        icon={<CalendarClock className="size-5" />}
        title={emptyTitle}
        description={emptyHint}
      />
    );
  }
  return view === "cards" ? (
    <CardsView items={items} />
  ) : (
    <ListView items={items} />
  );
}

function CardsView({ items }: { items: PatientAppointment[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((a) => (
        <AppointmentCard key={a.id} appt={a} />
      ))}
    </div>
  );
}

function AppointmentCard({ appt }: { appt: PatientAppointment }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const joinable = isJoinable(appt);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const owed =
    appt.invoice_balance_cents && appt.invoice_balance_cents > 0
      ? appt.invoice_balance_cents
      : 0;

  const openPay = () => {
    if (!appt.invoice_id || !owed) return;
    // The PayInvoiceModal's `Invoice` type wants more fields than we have
    // here; only id/number/balanceCents matter for triggering the flow.
    setPayingInvoice({
      id: appt.invoice_id,
      number: appt.service_name ?? "appointment",
      status: "open",
      totalCents: appt.invoice_total_cents ?? owed,
      paidCents: (appt.invoice_total_cents ?? owed) - owed,
      balanceCents: owed,
      issuedAt: null,
      dueAt: null,
    });
  };

  const handleCloseModal = () => {
    setPayingInvoice(null);
    queryClient.invalidateQueries({ queryKey: ["appointments", "me"] });
  };

  return (
    <Card className="p-5 h-full flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <div className="size-11 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <CalendarClock className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold tabular-nums truncate">
            {humanWhen(appt.starts_at)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {typeLabel(appt.type)} · {appt.duration_minutes} min
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[appt.status] ?? "neutral"} size="sm">
          {appt.status}
        </Badge>
      </div>

      <dl className="space-y-2 text-sm">
        {appt.provider_name && (
          <div className="flex items-start gap-2">
            <Stethoscope className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-foreground/90 truncate">{appt.provider_name}</div>
              {appt.provider_specialty && (
                <div className="text-[11px] text-muted-foreground">
                  {appt.provider_specialty}
                </div>
              )}
            </div>
          </div>
        )}
        {appt.room && (
          <div className="flex items-center gap-2">
            <MapPin className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-foreground/90">{appt.room}</span>
          </div>
        )}
        {appt.reason && (
          <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {appt.reason}
          </div>
        )}
      </dl>

      {owed > 0 && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Receipt className="size-3.5 text-amber-600 shrink-0" />
            <div className="text-xs min-w-0">
              <div className="font-semibold text-amber-900 tabular-nums">
                Owed: ${(owed / 100).toFixed(2)}
              </div>
              {appt.service_name && (
                <div className="text-amber-800 truncate">{appt.service_name}</div>
              )}
            </div>
          </div>
          <Button size="sm" onClick={openPay}>
            Pay now
          </Button>
        </div>
      )}

      {joinable && (
        <div className="pt-4 mt-auto">
          <Button
            size="sm"
            onClick={() => navigate(`/telehealth/${appt.id}`)}
          >
            <Video className="size-3.5" />
            Join video visit
          </Button>
        </div>
      )}

      <PayInvoiceModal
        invoice={payingInvoice}
        onClose={handleCloseModal}
      />
    </Card>
  );
}

function ListView({ items }: { items: PatientAppointment[] }) {
  return (
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
  );
}

function AppointmentRow({ appt }: { appt: PatientAppointment }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const joinable = isJoinable(appt);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const owed =
    appt.invoice_balance_cents && appt.invoice_balance_cents > 0
      ? appt.invoice_balance_cents
      : 0;

  const openPay = () => {
    if (!appt.invoice_id || !owed) return;
    setPayingInvoice({
      id: appt.invoice_id,
      number: appt.service_name ?? "appointment",
      status: "open",
      totalCents: appt.invoice_total_cents ?? owed,
      paidCents: (appt.invoice_total_cents ?? owed) - owed,
      balanceCents: owed,
      issuedAt: null,
      dueAt: null,
    });
  };

  const handleCloseModal = () => {
    setPayingInvoice(null);
    queryClient.invalidateQueries({ queryKey: ["appointments", "me"] });
  };

  return (
    <>
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
          <div className="flex items-center justify-end gap-2">
            {owed > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 tabular-nums">
                <Receipt className="size-3.5 text-amber-600" />
                Owed ${(owed / 100).toFixed(2)}
                <Button size="xs" onClick={openPay}>
                  Pay
                </Button>
              </span>
            )}
            <Badge variant={STATUS_VARIANT[appt.status] ?? "neutral"} size="sm">
              {appt.status}
            </Badge>
            {joinable && (
              <Button
                size="xs"
                onClick={() => navigate(`/telehealth/${appt.id}`)}
              >
                <Video className="size-3.5" />
                Join
              </Button>
            )}
          </div>
        </td>
      </tr>
      <PayInvoiceModal
        invoice={payingInvoice}
        onClose={handleCloseModal}
      />
    </>
  );
}
