import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CalendarX2,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  MapPin,
  Receipt,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Timer,
  Video,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
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
type Filter = "all" | "virtual" | "in_person" | "owed" | "today";

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

const STATUS_ACCENT: Record<string, string> = {
  scheduled: "bg-primary",
  confirmed: "bg-success",
  pending: "bg-warning",
  completed: "bg-slate-300",
  cancelled: "bg-danger",
  "no-show": "bg-danger",
};

function typeLabel(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1).replace("-", " ");
}

function isJoinable(appt: PatientAppointment): boolean {
  if (appt.modality !== "virtual") return false;
  const blocked = new Set(["completed", "cancelled", "no-show"]);
  if (blocked.has(appt.status)) return false;
  const now = Date.now();
  const start = new Date(appt.starts_at).getTime();
  if (Number.isNaN(start)) return false;
  return start - now <= 10 * 60_000 && now - start <= 60 * 60_000;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function useCountdown(iso: string): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  const diff = target - now;
  if (diff <= 0) return null;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const m = minutes % 60;
    return m ? `in ${hours}h ${m}m` : `in ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? `in 1 day` : `in ${days} days`;
}

export function AppointmentsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useAppointments();
  const [view, setView] = useState<View>("cards");
  const [filter, setFilter] = useState<Filter>("all");

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
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <TabsList>
              <TabsTrigger value="upcoming">
                Upcoming · {data.upcoming.length}
              </TabsTrigger>
              <TabsTrigger value="past">Past · {data.past.length}</TabsTrigger>
            </TabsList>
            <FilterRow filter={filter} onChange={setFilter} />
          </div>

          <TabsContent value="upcoming">
            <AppointmentsSection
              items={applyFilter(data.upcoming, filter)}
              view={view}
              emptyTitle="No upcoming appointments"
              emptyHint="When your provider schedules a visit, it'll appear here."
            />
          </TabsContent>

          <TabsContent value="past">
            <AppointmentsSection
              items={applyFilter(data.past, filter)}
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

function applyFilter(items: PatientAppointment[], filter: Filter): PatientAppointment[] {
  switch (filter) {
    case "virtual":
      return items.filter((a) => a.modality === "virtual");
    case "in_person":
      return items.filter((a) => a.modality === "in_person");
    case "owed":
      return items.filter(
        (a) => (a.invoice_balance_cents ?? 0) > 0
      );
    case "today":
      return items.filter((a) => isToday(a.starts_at));
    default:
      return items;
  }
}

function FilterRow({
  filter,
  onChange,
}: {
  filter: Filter;
  onChange: (f: Filter) => void;
}) {
  const chips: { value: Filter; label: string; icon?: React.ReactNode }[] = [
    { value: "all", label: "All" },
    { value: "virtual", label: "Video", icon: <Video className="size-3.5" /> },
    { value: "in_person", label: "In person", icon: <MapPin className="size-3.5" /> },
    { value: "owed", label: "Pending payment", icon: <Receipt className="size-3.5" /> },
    { value: "today", label: "Today", icon: <Sparkles className="size-3.5" /> },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => {
        const active = filter === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium border transition ring-focus",
              active
                ? "bg-slate-900 text-white border-slate-900 shadow-soft"
                : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:border-slate-300"
            )}
          >
            {c.icon}
            {c.label}
          </button>
        );
      })}
    </div>
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
    <div className="inline-flex items-center gap-1 rounded-full bg-white/70 backdrop-blur p-1 border border-slate-200 shadow-soft">
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
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
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
        icon={<CalendarX2 className="size-5" />}
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
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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
  const countdown = useCountdown(appt.starts_at);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const owed =
    appt.invoice_balance_cents && appt.invoice_balance_cents > 0
      ? appt.invoice_balance_cents
      : 0;
  const isVirtual = appt.modality === "virtual";
  const accent = STATUS_ACCENT[appt.status] ?? "bg-slate-300";
  const providerName = appt.provider_name ?? "Care team";

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
    <Card
      className={cn(
        "relative overflow-hidden p-0 h-full flex flex-col",
        "rounded-[24px] border-slate-200/70 bg-white",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-12px_rgba(15,23,42,0.12)]",
        "transition-all duration-200 hover:-translate-y-0.5",
        "hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_20px_50px_-12px_rgba(15,23,42,0.18)]"
      )}
    >
      {/* Left status accent */}
      <span
        aria-hidden
        className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-[24px]", accent)}
      />

      <div className="p-4 lg:p-5 flex flex-col h-full gap-3">
        {/* Header: when + status pill */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[18px] font-semibold tracking-tight text-slate-900 tabular-nums truncate">
              {humanWhen(appt.starts_at)}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-slate-500">
              <span className="font-medium text-slate-700">
                {typeLabel(appt.type)}
              </span>
              <span className="size-1 rounded-full bg-slate-300" />
              <span>{appt.duration_minutes} min</span>
              {countdown && (
                <>
                  <span className="size-1 rounded-full bg-slate-300" />
                  <span className="inline-flex items-center gap-1 text-primary font-medium">
                    <Timer className="size-3" />
                    {countdown}
                  </span>
                </>
              )}
            </div>
          </div>
          <Badge variant={STATUS_VARIANT[appt.status] ?? "neutral"} size="sm" dot>
            {appt.status}
          </Badge>
        </div>

        {/* Doctor section */}
        <div className="flex items-center gap-2.5 py-2 px-2.5 rounded-2xl bg-slate-50/70 border border-slate-100">
          <UserAvatar name={providerName} src={appt.provider_avatar_url ?? undefined} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold text-slate-900 truncate">
                {providerName}
              </span>
              <ShieldCheck className="size-3 text-success shrink-0" aria-label="Insurance verified" />
            </div>
            <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
              {appt.provider_specialty && (
                <>
                  <Stethoscope className="size-3" />
                  <span className="truncate">{appt.provider_specialty}</span>
                </>
              )}
              {(appt.room || isVirtual) && (
                <>
                  {appt.provider_specialty && <span className="size-1 rounded-full bg-slate-300 shrink-0" />}
                  {isVirtual ? <Video className="size-3 shrink-0" /> : <MapPin className="size-3 shrink-0" />}
                  <span className="truncate">{isVirtual ? "Video" : appt.room}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {owed > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="size-7 rounded-lg bg-white border border-amber-200 grid place-items-center shrink-0">
                <Receipt className="size-3.5 text-amber-600" />
              </div>
              <div className="text-[11px] min-w-0 leading-tight">
                <div className="font-semibold text-amber-900 tabular-nums">
                  ${(owed / 100).toFixed(2)} outstanding
                </div>
                <div className="text-amber-700/80">Due before visit</div>
              </div>
            </div>
            <Button
              size="xs"
              onClick={openPay}
              className="bg-amber-500 hover:bg-amber-600 text-white shadow-none"
            >
              Pay now
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex items-center gap-1.5 pt-0.5">
          {joinable ? (
            <Button
              size="sm"
              onClick={() => navigate(`/telehealth/${appt.id}`)}
              className="flex-1"
            >
              <Video className="size-3.5" />
              Join visit
            </Button>
          ) : (
            isVirtual && appt.status !== "completed" && appt.status !== "cancelled" && (
              <Button size="sm" variant="soft" disabled className="flex-1">
                <Video className="size-3.5" />
                Opens 10 min before
              </Button>
            )
          )}
          {appt.status !== "completed" && appt.status !== "cancelled" && (
            <>
              <Button size="sm" variant="secondary">
                Reschedule
              </Button>
              <Button size="sm" variant="ghost">
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      <PayInvoiceModal invoice={payingInvoice} onClose={handleCloseModal} />
    </Card>
  );
}

function ListView({ items }: { items: PatientAppointment[] }) {
  return (
    <Card className="overflow-hidden p-3 sm:p-4 rounded-3xl">
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
  const providerName = appt.provider_name ?? null;

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
          <span className="inline-flex items-center gap-1.5">
            {appt.modality === "virtual" ? (
              <Video className="size-3.5 text-primary" />
            ) : (
              <MapPin className="size-3.5 text-slate-400" />
            )}
            {typeLabel(appt.type)}
          </span>
        </td>
        <td className="px-4 py-2 text-foreground/80" style={{ background: TABLE_ROW_BG }}>
          {providerName ? (
            <div className="flex items-center gap-2 min-w-0">
              <UserAvatar name={providerName} src={appt.provider_avatar_url ?? undefined} size="xs" />
              <div className="min-w-0">
                <div className="truncate">{providerName}</div>
                {appt.provider_specialty && (
                  <div className="text-[11px] text-muted-foreground truncate">
                    {appt.provider_specialty}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground italic">—</span>
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
