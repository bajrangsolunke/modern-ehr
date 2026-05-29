/**
 * Users management page (admin-only). User stories US-USER-1..US-USER-4
 * in docs/superpowers/specs/2026-05-27-workflow-user-stories.md.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Copy,
  Filter,
  LayoutGrid,
  Mail,
  Pencil,
  Plus,
  Rows3,
  Search,
  Send,
  Shield,
  ShieldOff,
  Stethoscope,
  UserCheck,
  Users,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { FilterChip } from "@/components/ui/filter-chip";
import { SortableTh, TABLE_ROW_BG } from "@/components/ui/sortable-th";
import { SummaryTile } from "@/components/ui/summary-tile";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/pagination";
import { UserDrawer } from "@/features/users/components/UserDrawer";
import { UserCardGrid } from "@/features/users/components/UserCardGrid";
import {
  useDeactivateUser,
  useInviteUser,
  useReactivateUser,
  useUsers,
} from "@/features/users/hooks/use-users";
import type { AppUser, UserFilters } from "@/features/users/api/users-api";
import type { Role } from "@/types";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/lib/toast";

const ROLE_LABEL: Record<Role, string> = {
  provider: "Provider",
  staff: "Staff",
  admin: "Admin",
};
const ROLE_VARIANT: Record<Role, "info" | "neutral" | "danger"> = {
  provider: "info",
  staff: "neutral",
  admin: "danger",
};
const ROLES_IN_ORDER: Role[] = ["provider", "staff", "admin"];

type ViewMode = "table" | "cards";

export function UsersPage() {
  const [filters, setFilters] = useState<UserFilters>({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
  });
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<AppUser | null>(null);
  const [inviteResult, setInviteResult] = useState<{
    user: AppUser;
    setupUrl: string;
    emailQueued: boolean;
  } | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useUsers(filters);
  const reactivate = useReactivateUser();
  const deactivate = useDeactivateUser();
  const invite = useInviteUser();

  const setFilter = (patch: Partial<UserFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }));

  const counts = useMemo(() => {
    const items = data?.items ?? [];
    return {
      total: data?.total ?? 0,
      admins: items.filter((u) => u.role === "admin").length,
      providers: items.filter((u) => u.role === "provider").length,
      staff: items.filter((u) => u.role === "staff").length,
    };
  }, [data]);

  const activeFilterCount =
    (filters.role ? 1 : 0) + (filters.is_active !== undefined ? 1 : 0);

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (u: AppUser) => {
    setEditing(u);
    setDrawerOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Users"
        right={
          <>
            <HeaderSearch
              value={filters.q ?? ""}
              onChange={(v) => setFilter({ q: v || undefined })}
              placeholder="Search name or email…"
            />
            <FilterPopover
              activeCount={activeFilterCount}
              renderBody={(close) => (
                <FilterPopoverBody
                  filters={filters}
                  setFilter={setFilter}
                  onClear={() => {
                    setFilter({ role: undefined, is_active: undefined });
                    close();
                  }}
                />
              )}
            />
            <ViewToggle mode={viewMode} onChange={setViewMode} />
            <Button className="h-10" onClick={openCreate}>
              <Plus className="size-4" /> New user
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3 mb-3">
        <SummaryTile
          label="Total users"
          value={counts.total}
          icon={<Users />}
          tone="primary"
        />
        <SummaryTile
          label="Admins"
          value={counts.admins}
          icon={<Shield />}
          tone="danger"
        />
        <SummaryTile
          label="Providers"
          value={counts.providers}
          icon={<Stethoscope />}
          tone="info"
        />
        <SummaryTile
          label="Staff"
          value={counts.staff}
          icon={<Briefcase />}
          tone="neutral"
        />
      </div>

      {isLoading && <TableSkeleton rows={8} cols={6} />}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load users"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && data && (
        <>
          {inviteResult && (
            <InviteBanner
              user={inviteResult.user}
              setupUrl={inviteResult.setupUrl}
              emailQueued={inviteResult.emailQueued}
              onClose={() => setInviteResult(null)}
            />
          )}

          {viewMode === "table" ? (
            <UserTable
              items={data.items}
              onEdit={openEdit}
              onDeactivate={(u) => setPendingDeactivate(u)}
              onReactivate={(u) => reactivate.mutate(u.id)}
              onInvite={async (u) => {
                const result = await invite.mutateAsync(u.id);
                setInviteResult({ user: u, setupUrl: result.setupUrl, emailQueued: result.emailQueued });
              }}
            />
          ) : (
            <UserCardGrid
              data={data.items}
              onEdit={openEdit}
              onDeactivate={(u) => setPendingDeactivate(u)}
              onReactivate={(u) => reactivate.mutate(u.id)}
            />
          )}

          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            shown={data.items.length}
            noun="user"
            pageSize={filters.page_size}
            onPageSizeChange={(size) =>
              setFilters((prev) => ({ ...prev, page_size: size, page: 1 }))
            }
            onChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
          />
        </>
      )}

      <UserDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setEditing(null);
        }}
        user={editing ?? undefined}
      />

      <ConfirmDialog
        open={Boolean(pendingDeactivate)}
        onOpenChange={(open) => !open && setPendingDeactivate(null)}
        title={
          pendingDeactivate
            ? `Deactivate ${pendingDeactivate.fullName}?`
            : "Deactivate user?"
        }
        description="The user won't be able to sign in. Their audit history stays intact and an admin can reactivate them later."
        confirmLabel="Deactivate"
        destructive
        busy={deactivate.isPending}
        onConfirm={async () => {
          if (!pendingDeactivate) return;
          await deactivate.mutateAsync(pendingDeactivate.id);
          setPendingDeactivate(null);
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
        active={mode === "table"}
        onClick={() => onChange("table")}
        label="Table view"
        icon={<Rows3 className="size-3.5" />}
      />
      <ViewToggleButton
        active={mode === "cards"}
        onClick={() => onChange("cards")}
        label="Card view"
        icon={<LayoutGrid className="size-3.5" />}
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

function HeaderSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="w-52">
      <Input
        icon={<Search className="size-3.5" />}
        iconPosition="right"
        iconBg
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white"
      />
    </div>
  );
}

function FilterPopover({
  activeCount,
  renderBody,
}: {
  activeCount: number;
  renderBody: (closePopover: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="secondary" className="h-10 rounded-full px-4 relative">
          <Filter className="size-4" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 inline-grid place-items-center min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeCount}
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
          {renderBody(() => setOpen(false))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function FilterPopoverBody({
  filters,
  setFilter,
  onClear,
}: {
  filters: UserFilters;
  setFilter: (patch: Partial<UserFilters>) => void;
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

      <FilterGroup label="Role">
        <FilterChip
          label="All"
          active={filters.role === undefined}
          onClick={() => setFilter({ role: undefined })}
        />
        {ROLES_IN_ORDER.map((r) => (
          <FilterChip
            key={r}
            label={ROLE_LABEL[r]}
            active={filters.role === r}
            onClick={() => setFilter({ role: r })}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Status">
        <FilterChip
          label="Active"
          tone="success"
          dashed
          active={filters.is_active === true}
          onClick={() =>
            setFilter({
              is_active: filters.is_active === true ? undefined : true,
            })
          }
        />
        <FilterChip
          label="Deactivated"
          tone="muted"
          dashed
          active={filters.is_active === false}
          onClick={() =>
            setFilter({
              is_active: filters.is_active === false ? undefined : false,
            })
          }
        />
      </FilterGroup>
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

/* -------------------------------------------------------------------------- */

function UserTable({
  items,
  onEdit,
  onDeactivate,
  onReactivate,
  onInvite,
}: {
  items: AppUser[];
  onEdit: (u: AppUser) => void;
  onDeactivate: (u: AppUser) => void;
  onReactivate: (u: AppUser) => void;
  onInvite: (u: AppUser) => void;
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
              <SortableTh first>Name</SortableTh>
              <SortableTh>Email</SortableTh>
              <SortableTh>Role</SortableTh>
              <SortableTh>Specialty</SortableTh>
              <SortableTh>Status</SortableTh>
              <SortableTh>Created</SortableTh>
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
                  No users match these filters.
                </td>
              </tr>
            )}
            {items.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                onEdit={() => onEdit(u)}
                onDeactivate={() => onDeactivate(u)}
                onReactivate={() => onReactivate(u)}
                onInvite={() => onInvite(u)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function UserRow({
  user,
  onEdit,
  onDeactivate,
  onReactivate,
  onInvite,
}: {
  user: AppUser;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onInvite: () => void;
}) {
  return (
    <tr
      className={cn(
        "hover:[&_td]:bg-[#EEF2F8] transition group",
        !user.isActive && "opacity-60"
      )}
    >
      <Cell first>
        <div className="flex items-center gap-2">
          <UserAvatar
            name={user.fullName}
            src={user.avatarUrl ?? undefined}
            size="sm"
          />
          <Link
            to={`/users/${user.id}`}
            className="font-semibold hover:text-primary transition"
          >
            {user.fullName}
          </Link>
        </div>
      </Cell>
      <Cell>
        <span className="text-foreground/80">{user.email}</span>
      </Cell>
      <Cell>
        <Badge variant={ROLE_VARIANT[user.role]} size="sm">
          {ROLE_LABEL[user.role]}
        </Badge>
      </Cell>
      <Cell>
        <span className="text-foreground/80">{user.specialty || "—"}</span>
      </Cell>
      <Cell>
        {user.isActive ? (
          <Badge variant="success" dot size="sm">
            Active
          </Badge>
        ) : (
          <Badge variant="neutral" dot size="sm">
            Deactivated
          </Badge>
        )}
      </Cell>
      <Cell>
        <span className="text-foreground/80">{formatDate(user.createdAt)}</span>
      </Cell>
      <Cell last>
        <div className="flex items-center justify-end gap-1">
          <RowIconButton
            label="Edit user"
            onClick={onEdit}
            icon={<Pencil className="size-3" />}
          />
          <RowIconButton
            label="Invite to portal"
            onClick={onInvite}
            icon={<Send className="size-3" />}
          />
          {user.isActive ? (
            <RowIconButton
              label="Deactivate user"
              onClick={onDeactivate}
              tone="danger"
              icon={<ShieldOff className="size-3" />}
            />
          ) : (
            <RowIconButton
              label="Reactivate user"
              onClick={onReactivate}
              tone="success"
              icon={<UserCheck className="size-3" />}
            />
          )}
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

function InviteBanner({
  user,
  setupUrl,
  emailQueued,
  onClose,
}: {
  user: AppUser;
  setupUrl: string;
  emailQueued: boolean;
  onClose: () => void;
}) {
  const copyUrl = async () => {
    await navigator.clipboard.writeText(setupUrl);
    toast.success("Invite URL copied");
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 mb-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          {emailQueued ? (
            <>
              <Mail className="size-4" />
              Invite sent to {user.email}
            </>
          ) : (
            <>
              <Send className="size-4" />
              Invite URL ready · copy &amp; share manually
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Dismiss
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-1 mb-3">
        {emailQueued
          ? "The setup link was emailed. You can also copy it below."
          : "SMTP isn't configured — share this one-time URL with the user directly. It expires in 24 hours."}
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={setupUrl}
          className="flex-1 h-9 rounded-full border border-border bg-white px-3 text-xs font-mono ring-focus"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <Button variant="secondary" size="sm" onClick={copyUrl} className="h-9">
          <Copy className="size-3.5" /> Copy
        </Button>
      </div>
    </div>
  );
}

function RowIconButton({
  label,
  onClick,
  icon,
  tone = "neutral",
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  tone?: "neutral" | "danger" | "success";
}) {
  const toneClass = {
    neutral: "text-foreground/70 hover:bg-white/80",
    danger: "text-danger hover:bg-rose-50",
    success: "text-success hover:bg-emerald-50",
  }[tone];
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("size-7 rounded-full bg-white", toneClass)}
      aria-label={label}
      onClick={onClick}
    >
      {icon}
    </Button>
  );
}
