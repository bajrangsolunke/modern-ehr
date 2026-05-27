/**
 * Appointments management page. User stories US-APPT-1..US-APPT-4
 * in docs/superpowers/specs/2026-05-27-workflow-user-stories.md.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCheck,
  Filter,
  List,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { FilterChip } from "@/components/ui/filter-chip";
import { SortableTh, TABLE_ROW_BG } from "@/components/ui/sortable-th";
import { AppointmentModal } from "@/features/appointments/components/AppointmentModal";
import { AppointmentDetailsModal } from "@/features/appointments/components/AppointmentDetailsModal";
import {
  AppointmentsCalendar,
  rangeForMode,
  type CalendarMode,
} from "@/features/appointments/components/AppointmentsCalendar";
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
const STATUSES_IN_ORDER: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "pending",
  "completed",
  "cancelled",
  "no-show",
];

type DatePreset = "all" | "today" | "week" | "upcoming";
const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "all", label: "All time" },
];

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
  if (preset === "upcoming") return { start: new Date().toISOString() };
  return {};
}

type ViewMode = "list" | "calendar";

export function AppointmentsPage() {
  const user = useAuthStore((s) => s.user);
  const [view, setView] = useState<ViewMode>("list");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [status, setStatus] = useState<AppointmentStatus | undefined>();
  const [preset, setPreset] = useState<DatePreset>("upcoming");
  const [scope, setScope] = useState<"all" | "mine">(
    user?.role === "provider" ? "mine" : "all"
  );
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("week");
  const [calendarCursor, setCalendarCursor] = useState<Date>(() => new Date());

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [viewing, setViewing] = useState<Appointment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Appointment | null>(null);

  // rangeFor() calls `new Date()` for the "upcoming" preset, which
  // shifts by milliseconds. Memoize to prevent the React Query key
  // changing on every render → refetch loop → 429.
  const range = useMemo(() => rangeFor(preset), [preset]);
  const physicianFilter =
    scope === "mine" && user?.role === "provider" ? user.id : undefined;

  // Calendar mode drives the date range from its own cursor + sub-view.
  const calendarRange = useMemo(() => {
    const { start, end } = rangeForMode(calendarMode, calendarCursor);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [calendarMode, calendarCursor]);

  const filters = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      status,
      start_date: view === "calendar" ? calendarRange.start : range.start,
      end_date: view === "calendar" ? calendarRange.end : range.end,
      physician_id: physicianFilter,
      sort_dir: preset === "all" ? ("desc" as const) : ("asc" as const),
      limit: 500,
    }),
    [view, debouncedQuery, status, range, calendarRange, physicianFilter, preset]
  );

  const activeFilterCount =
    (status ? 1 : 0) +
    (view === "list" && preset !== "upcoming" ? 1 : 0) +
    (user?.role === "provider" && scope === "all" ? 1 : 0);

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
  const openDetails = (a: Appointment) => setViewing(a);

  return (
    <>
      <PageHeader
        title="Appointments"
        right={
          <>
            <ViewToggle mode={view} onChange={setView} />
            <Button className="h-10" onClick={openCreate}>
              <CalendarPlus className="size-4" /> New appointment
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3 mb-3">
        <CompactStat label="Today" value={stats?.today ?? "—"} tone="primary" />
        <CompactStat label="This week" value={stats?.thisWeek ?? "—"} tone="info" />
        <CompactStat
          label="Cancelled · 7d"
          value={stats?.cancellationsThisWeek ?? "—"}
          tone="warning"
        />
        <CompactStat
          label="No-shows · 7d"
          value={stats?.noShowsThisWeek ?? "—"}
          tone="muted"
        />
      </div>

      <Toolbar
        query={query}
        setQuery={setQuery}
        activeFilterCount={activeFilterCount}
        renderFilterBody={(close) => (
          <FilterPopoverBody
            status={status}
            setStatus={setStatus}
            preset={preset}
            setPreset={setPreset}
            userRole={user?.role}
            scope={scope}
            setScope={setScope}
            hideDateChips={view === "calendar"}
            today={today}
            onClear={() => {
              setStatus(undefined);
              if (view === "list") setPreset("upcoming");
              if (user?.role === "provider") setScope("mine");
              close();
            }}
          />
        )}
      />

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
        view === "list" ? (
          <AppointmentsTable
            items={data}
            onView={openDetails}
            onEdit={openEdit}
            onSetStatus={(id, s) => setStatusMutation.mutate(id, s)}
            onDelete={canDelete ? setPendingDelete : undefined}
            busy={setStatusMutation.isPending}
          />
        ) : (
          <AppointmentsCalendar
            mode={calendarMode}
            onModeChange={setCalendarMode}
            cursor={calendarCursor}
            onCursorChange={setCalendarCursor}
            appointments={data}
            onEdit={openDetails}
            onNew={() => openCreate()}
          />
        )
      )}

      <AppointmentDetailsModal
        open={Boolean(viewing)}
        onOpenChange={(open) => !open && setViewing(null)}
        appointment={viewing}
        onEdit={(a) => {
          setViewing(null);
          openEdit(a);
        }}
        onDelete={canDelete ? setPendingDelete : undefined}
      />

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

/* -------------------------------------------------------------------------- */

function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div className="bg-[#F1F4F9] rounded-full p-1 flex items-center gap-1">
      <ViewToggleButton
        active={mode === "list"}
        onClick={() => onChange("list")}
        label="List view"
        icon={<List className="size-3.5" />}
      />
      <ViewToggleButton
        active={mode === "calendar"}
        onClick={() => onChange("calendar")}
        label="Calendar view"
        icon={<CalendarDays className="size-3.5" />}
      />
    </div>
  );
}

function ViewToggleButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "size-8 grid place-items-center rounded-full transition",
        active
          ? "bg-primary-gradient text-white shadow-glow"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
    </button>
  );
}

function Toolbar({
  query,
  setQuery,
  activeFilterCount,
  renderFilterBody,
}: {
  query: string;
  setQuery: (v: string) => void;
  activeFilterCount: number;
  renderFilterBody: (closePopover: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="mb-3">
      <CardContent className="p-2 sm:p-3 flex items-center gap-2">
        <Input
          placeholder="Search patient name or MRN…"
          icon={<Search className="size-4" />}
          className="w-64 h-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <Button
              variant="secondary"
              className="h-10 rounded-full px-4 relative ml-auto shrink-0"
            >
              <Filter className="size-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 inline-grid place-items-center min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={6}
              className="z-50 w-[min(92vw,420px)] rounded-2xl bg-white shadow-elev border border-border p-4 animate-fade-in"
            >
              {renderFilterBody(() => setOpen(false))}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </CardContent>
    </Card>
  );
}

function FilterPopoverBody({
  status,
  setStatus,
  preset,
  setPreset,
  userRole,
  scope,
  setScope,
  hideDateChips,
  today,
  onClear,
}: {
  status: AppointmentStatus | undefined;
  setStatus: (s: AppointmentStatus | undefined) => void;
  preset: DatePreset;
  setPreset: (p: DatePreset) => void;
  userRole?: string;
  scope: "all" | "mine";
  setScope: (s: "all" | "mine") => void;
  hideDateChips?: boolean;
  today: Date;
  onClear: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Filters</h3>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Reset
        </button>
      </div>

      {!hideDateChips && (
        <FilterGroup label="Date">
          {DATE_PRESETS.map((p) => (
            <FilterChip
              key={p.value}
              label={p.label}
              active={preset === p.value}
              onClick={() => setPreset(p.value)}
            />
          ))}
        </FilterGroup>
      )}

      <FilterGroup label="Status">
        <FilterChip
          label="Any"
          active={status === undefined}
          onClick={() => setStatus(undefined)}
        />
        {STATUSES_IN_ORDER.map((s) => (
          <FilterChip
            key={s}
            label={labelize(s)}
            active={status === s}
            onClick={() => setStatus(status === s ? undefined : s)}
          />
        ))}
      </FilterGroup>

      {userRole === "provider" && (
        <FilterGroup label="Scope">
          <FilterChip
            label="Mine"
            active={scope === "mine"}
            onClick={() => setScope("mine")}
          />
          <FilterChip
            label="All providers"
            active={scope === "all"}
            onClick={() => setScope("all")}
          />
        </FilterGroup>
      )}

      <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/60">
        {today.toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function CompactStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
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
      <CardContent className="px-3 py-2.5 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </span>
        <span className={cn("text-xl font-bold tabular-nums", toneClass)}>
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function AppointmentsTable({
  items,
  onView,
  onEdit,
  onSetStatus,
  onDelete,
  busy,
}: {
  items: Appointment[];
  onView: (a: Appointment) => void;
  onEdit: (a: Appointment) => void;
  onSetStatus: (id: string, status: AppointmentStatus) => void;
  onDelete?: (a: Appointment) => void;
  busy?: boolean;
}) {
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
              <SortableTh>Patient</SortableTh>
              <SortableTh>Type</SortableTh>
              <SortableTh>Status</SortableTh>
              <SortableTh>Physician</SortableTh>
              <SortableTh>Room</SortableTh>
              <SortableTh last>Actions</SortableTh>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-muted-foreground rounded-2xl"
                  style={{ background: TABLE_ROW_BG }}
                >
                  No appointments in this view. Try a wider date range.
                </td>
              </tr>
            )}
            {items.map((a) => (
              <AppointmentRow
                key={a.id}
                appointment={a}
                onView={() => onView(a)}
                onEdit={() => onEdit(a)}
                onSetStatus={(s) => onSetStatus(a.id, s)}
                onDelete={onDelete ? () => onDelete(a) : undefined}
                busy={busy}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-xs text-muted-foreground text-right">
        {items.length} appointment{items.length === 1 ? "" : "s"}
      </div>
    </Card>
  );
}

function AppointmentRow({
  appointment,
  onView,
  onEdit,
  onSetStatus,
  onDelete,
  busy,
}: {
  appointment: Appointment;
  onView: () => void;
  onEdit: () => void;
  onSetStatus: (s: AppointmentStatus) => void;
  onDelete?: () => void;
  busy?: boolean;
}) {
  const a = appointment;
  // Clicking the row body opens details; nested interactives
  // (patient link, action buttons, dropdown) call stopPropagation so
  // they take precedence.
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest("a,button,[data-no-row-click]")) return;
    onView();
  };
  return (
    <tr
      onClick={handleRowClick}
      className={cn(
        "hover:[&_td]:bg-[#EEF2F8] transition group cursor-pointer",
        a.status === "cancelled" && "opacity-60"
      )}
    >
      <Cell first>
        <div className="font-semibold leading-tight">
          {formatDate(a.startsAt)}
        </div>
        <div className="text-xs text-muted-foreground">
          {a.time} · {a.duration} min
        </div>
      </Cell>
      <Cell>
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
            <div className="font-semibold truncate">{a.patientName}</div>
            {a.patientMrn && (
              <div className="text-[11px] text-muted-foreground">
                MRN {a.patientMrn}
              </div>
            )}
          </div>
        </Link>
      </Cell>
      <Cell>
        <span className="capitalize text-foreground/80">
          {a.type.replace(/-/g, " ")}
        </span>
      </Cell>
      <Cell>
        <Badge
          variant={STATUS_VARIANT[a.status]}
          size="sm"
          dot
          className="capitalize"
        >
          {a.status}
        </Badge>
      </Cell>
      <Cell>
        <span className="text-foreground/80">{a.physician}</span>
      </Cell>
      <Cell>
        <span className="text-foreground/80">{a.room || "—"}</span>
      </Cell>
      <Cell last>
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-full bg-white hover:bg-white/80 text-foreground/70"
            aria-label="Edit appointment"
            onClick={onEdit}
          >
            <Pencil className="size-3" />
          </Button>
          <RowMenu
            appointment={a}
            onSetStatus={onSetStatus}
            onEdit={onEdit}
            onDelete={onDelete}
            busy={busy}
          />
        </div>
      </Cell>
    </tr>
  );
}

function Cell({
  children,
  first,
  last,
}: {
  children: React.ReactNode;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-2",
        first && "first:rounded-l-full",
        last && "last:rounded-r-full"
      )}
      style={{ background: TABLE_ROW_BG }}
    >
      {children}
    </td>
  );
}

/* -------------------------------------------------------------------------- */

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
