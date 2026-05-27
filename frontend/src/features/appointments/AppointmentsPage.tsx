/**
 * Appointments management (US-AP1..US-AP9).
 *
 * Layout: stat tiles → filter bar (search + status chips + date range +
 * "Mine vs. all") → table with row actions → AppointmentModal for
 * create/edit (slot-based booking, drawer-free).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarPlus,
  Check,
  CheckCheck,
  ChevronsUpDown,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { AppointmentModal } from "@/features/appointments/components/AppointmentModal";
import {
  useAppointments,
  useAppointmentStats,
  useDeleteAppointment,
  useSetAppointmentStatus,
} from "@/features/appointments/hooks/use-appointments";
import { useAuthStore } from "@/stores/auth-store";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Appointment, AppointmentStatus } from "@/types";
import { cn, formatDate } from "@/lib/utils";

const ROW_BG = "#F5F7FB";
const HEADER_BG = "#FFFFFF";
const HEADER_SHADOW = "0 4px 12px rgba(17,24,39,0.06)";

const STATUS_VARIANT: Record<
  AppointmentStatus,
  "info" | "warning" | "success" | "neutral" | "danger"
> = {
  scheduled: "info",
  confirmed: "info",
  pending: "warning",
  completed: "success",
  cancelled: "danger",
  "no-show": "neutral",
};

type DatePreset = "all" | "today" | "week" | "upcoming";

function rangeFor(preset: DatePreset): { start?: string; end?: string } {
  const now = new Date();
  if (preset === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (preset === "week") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - start.getDay() + (start.getDay() === 0 ? -6 : 1));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (preset === "upcoming") {
    return { start: new Date().toISOString() };
  }
  return {};
}

export function AppointmentsPage() {
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [status, setStatus] = useState<AppointmentStatus | undefined>();
  const [preset, setPreset] = useState<DatePreset>("upcoming");
  const [scope, setScope] = useState<"all" | "mine">(
    user?.role === "provider" ? "mine" : "all"
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Appointment | null>(null);

  /*
   * Lock the date range to a stable reference per preset selection.
   * rangeFor() calls `new Date()` for the "upcoming" preset, which
   * shifts by milliseconds on every render. Without useMemo, the
   * filters object's identity (and the React Query key it feeds)
   * mutates on every render — we end up in a refetch loop that
   * hammers the API rate limit and returns 429s.
   */
  const range = useMemo(() => rangeFor(preset), [preset]);
  const physicianFilter =
    scope === "mine" && user?.role === "provider" ? user.id : undefined;

  const filters = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      status,
      start_date: range.start,
      end_date: range.end,
      physician_id: physicianFilter,
      sort_dir:
        preset === "all" ? ("desc" as const) : ("asc" as const),
      limit: 200,
    }),
    [debouncedQuery, status, range, physicianFilter, preset]
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useAppointments(filters);
  const { data: stats } = useAppointmentStats(physicianFilter);
  const setStatusMutation = useSetAppointmentStatus();
  const remove = useDeleteAppointment();
  const canDelete = user?.role === "admin";

  const today = useMemo(() => new Date(), []);
  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (a: Appointment) => {
    setEditing(a);
    setDrawerOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle={`Today · ${today.toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })}`}
        right={
          <Button className="h-10" onClick={openCreate}>
            <CalendarPlus className="size-4" /> New appointment
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4">
        <StatTile label="Today" value={stats?.today ?? "—"} tone="primary" />
        <StatTile label="This week" value={stats?.thisWeek ?? "—"} tone="info" />
        <StatTile
          label="Cancellations · 7d"
          value={stats?.cancellationsThisWeek ?? "—"}
          tone="warning"
        />
        <StatTile
          label="No-shows · 7d"
          value={stats?.noShowsThisWeek ?? "—"}
          tone="muted"
        />
      </div>

      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search patient name or MRN…"
            icon={<Search className="size-4" />}
            className="w-64 h-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="w-px h-6 bg-border mx-1" />

          {(["upcoming", "today", "week", "all"] as DatePreset[]).map((p) => (
            <Chip
              key={p}
              label={
                p === "all"
                  ? "All time"
                  : p === "upcoming"
                  ? "Upcoming"
                  : p === "today"
                  ? "Today"
                  : "This week"
              }
              active={preset === p}
              onClick={() => setPreset(p)}
            />
          ))}

          <div className="w-px h-6 bg-border mx-1" />

          <Chip
            label="All statuses"
            active={status === undefined}
            onClick={() => setStatus(undefined)}
          />
          {(
            [
              "scheduled",
              "confirmed",
              "pending",
              "completed",
              "cancelled",
              "no-show",
            ] as AppointmentStatus[]
          ).map((s) => (
            <Chip
              key={s}
              label={labelize(s)}
              active={status === s}
              onClick={() => setStatus(status === s ? undefined : s)}
            />
          ))}

          {user?.role === "provider" && (
            <>
              <div className="w-px h-6 bg-border mx-1" />
              <Chip
                label="Mine"
                active={scope === "mine"}
                onClick={() => setScope("mine")}
              />
              <Chip
                label="All providers"
                active={scope === "all"}
                onClick={() => setScope("all")}
              />
            </>
          )}
        </CardContent>
      </Card>

      {isLoading && <TableSkeleton rows={8} cols={7} />}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load appointments"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && data && (
        <Card className="overflow-hidden p-3 sm:p-4">
          <div className="overflow-x-auto">
            <table
              className="w-full text-sm border-separate"
              style={{ borderSpacing: "0 6px" }}
            >
              <thead>
                <tr className="text-xs text-muted-foreground text-left">
                  <Th first>When</Th>
                  <Th>Patient</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Physician</Th>
                  <Th>Room</Th>
                  <th
                    className="font-medium px-4 py-2 text-right last:rounded-r-full"
                    style={{ background: HEADER_BG, boxShadow: HEADER_SHADOW }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-muted-foreground rounded-2xl"
                      style={{ background: ROW_BG }}
                    >
                      No appointments in this view. Try a wider date range.
                    </td>
                  </tr>
                )}
                {data.map((a) => (
                  <tr
                    key={a.id}
                    className={cn(
                      "hover:[&_td]:bg-[#EEF2F8] transition group",
                      a.status === "cancelled" && "opacity-60"
                    )}
                  >
                    <td
                      className="px-4 py-2 first:rounded-l-full"
                      style={{ background: ROW_BG }}
                    >
                      <div className="font-semibold leading-tight">
                        {formatDate(a.startsAt)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.time} · {a.duration} min
                      </div>
                    </td>
                    <td className="px-4 py-2" style={{ background: ROW_BG }}>
                      <Link
                        to={`/patients/${a.patientId}`}
                        className="flex items-center gap-2 hover:text-primary transition"
                      >
                        <UserAvatar
                          name={a.patientName}
                          src={a.patientAvatarUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {a.patientName}
                          </div>
                          {a.patientMrn && (
                            <div className="text-[11px] text-muted-foreground">
                              MRN {a.patientMrn}
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td
                      className="px-4 py-2 capitalize text-foreground/80"
                      style={{ background: ROW_BG }}
                    >
                      {a.type.replace(/-/g, " ")}
                    </td>
                    <td className="px-4 py-2" style={{ background: ROW_BG }}>
                      <Badge
                        variant={STATUS_VARIANT[a.status]}
                        size="sm"
                        dot
                        className="capitalize"
                      >
                        {a.status}
                      </Badge>
                    </td>
                    <td
                      className="px-4 py-2 text-foreground/80"
                      style={{ background: ROW_BG }}
                    >
                      {a.physician}
                    </td>
                    <td
                      className="px-4 py-2 text-foreground/80"
                      style={{ background: ROW_BG }}
                    >
                      {a.room || "—"}
                    </td>
                    <td
                      className="px-4 py-2 last:rounded-r-full"
                      style={{ background: ROW_BG }}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-full bg-white hover:bg-white/80 text-foreground/70"
                          aria-label="Edit appointment"
                          onClick={() => openEdit(a)}
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <RowMenu
                          appointment={a}
                          onSetStatus={(s) =>
                            setStatusMutation.mutate(a.id, s)
                          }
                          onEdit={() => openEdit(a)}
                          onDelete={
                            canDelete ? () => setPendingDelete(a) : undefined
                          }
                          busy={setStatusMutation.isPending}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-muted-foreground text-right">
            {data.length} appointment{data.length === 1 ? "" : "s"}
          </div>
        </Card>
      )}

      <AppointmentModal
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setEditing(null);
        }}
        appointment={editing ?? undefined}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Remove appointment?"
        description="This permanently deletes the appointment. Prefer Cancel if you only want to mark it cancelled."
        confirmLabel="Remove"
        destructive
        busy={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await remove.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}

function Th({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <th
      className={cn("font-medium px-4 py-2", first && "first:rounded-l-full")}
      style={{ background: HEADER_BG, boxShadow: HEADER_SHADOW }}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground transition"
      >
        {children}
        <ChevronsUpDown className="size-3 opacity-60" />
      </button>
    </th>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 h-8 rounded-full text-xs font-medium border transition ring-focus",
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
      )}
    >
      {label}
    </button>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "primary" | "info" | "warning" | "muted";
}) {
  const toneClass = {
    primary: "text-primary",
    info: "text-info",
    warning: "text-warning",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </div>
        <div className={cn("mt-2 text-3xl font-bold", toneClass)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function RowMenu({
  appointment,
  onSetStatus,
  onEdit,
  onDelete,
  busy,
}: {
  appointment: Appointment;
  onSetStatus: (s: AppointmentStatus) => void;
  onEdit: () => void;
  onDelete?: () => void;
  busy?: boolean;
}) {
  const isOpen =
    appointment.status !== "completed" && appointment.status !== "cancelled";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-full bg-white text-foreground/70"
          aria-label="Appointment actions"
        >
          <MoreVertical className="size-3" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-48 rounded-2xl bg-white shadow-elev border border-border p-1.5 animate-fade-in"
        >
          <MenuItem icon={<Pencil className="size-4" />} onSelect={onEdit}>
            Edit / reschedule
          </MenuItem>
          <DropdownMenu.Separator className="h-px bg-border my-1" />
          {isOpen && appointment.status !== "confirmed" && (
            <MenuItem
              icon={<Check className="size-4" />}
              onSelect={() => onSetStatus("confirmed")}
              disabled={busy}
            >
              Mark confirmed
            </MenuItem>
          )}
          {isOpen && (
            <MenuItem
              icon={<CheckCheck className="size-4" />}
              onSelect={() => onSetStatus("completed")}
              disabled={busy}
            >
              Mark completed
            </MenuItem>
          )}
          {isOpen && (
            <MenuItem
              icon={<XCircle className="size-4" />}
              onSelect={() => onSetStatus("no-show")}
              disabled={busy}
            >
              Mark no-show
            </MenuItem>
          )}
          {isOpen && (
            <MenuItem
              icon={<X className="size-4" />}
              onSelect={() => onSetStatus("cancelled")}
              destructive
              disabled={busy}
            >
              Cancel
            </MenuItem>
          )}
          {onDelete && (
            <>
              <DropdownMenu.Separator className="h-px bg-border my-1" />
              <MenuItem
                icon={<Trash2 className="size-4" />}
                onSelect={onDelete}
                destructive
              >
                Remove (admin)
              </MenuItem>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({
  icon,
  children,
  onSelect,
  destructive,
  disabled,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm rounded-xl cursor-pointer outline-none data-[disabled]:opacity-50",
        destructive
          ? "hover:bg-danger/10 text-danger"
          : "hover:bg-secondary text-foreground"
      )}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

function labelize(v: string): string {
  return v
    .split(/[-_]/)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}
