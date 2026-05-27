/**
 * Users management page (admin-only). User stories US-USER-1..US-USER-4
 * in docs/superpowers/specs/2026-05-27-workflow-user-stories.md.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutGrid,
  Pencil,
  Plus,
  Rows3,
  Search,
  ShieldOff,
  UserCheck,
  Users,
} from "lucide-react";
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
import { SummaryTile } from "@/components/ui/summary-tile";
import { Pagination } from "@/components/ui/pagination";
import { UserDrawer } from "@/features/users/components/UserDrawer";
import { UserCardGrid } from "@/features/users/components/UserCardGrid";
import {
  useDeactivateUser,
  useReactivateUser,
  useUsers,
} from "@/features/users/hooks/use-users";
import type { AppUser, UserFilters } from "@/features/users/api/users-api";
import type { Role } from "@/types";
import { cn, formatDate } from "@/lib/utils";

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
  const [filters, setFilters] = useState<UserFilters>({ page: 1, page_size: 20 });
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<AppUser | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useUsers(filters);
  const reactivate = useReactivateUser();
  const deactivate = useDeactivateUser();

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
            <Input
              placeholder="Search name or email…"
              icon={<Search className="size-4" />}
              className="w-56 lg:w-72 h-10"
              value={filters.q ?? ""}
              onChange={(e) => setFilter({ q: e.target.value || undefined })}
            />
            <ViewToggle mode={viewMode} onChange={setViewMode} />
            <Button className="h-10" onClick={openCreate}>
              <Plus className="size-4" /> New user
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 mb-4">
        <SummaryTile label="Total users" value={counts.total} icon={<Users />} />
        <SummaryTile
          label="Admins"
          value={counts.admins}
          icon={<UserCheck />}
          tone="danger"
        />
        <SummaryTile label="Providers" value={counts.providers} tone="info" />
        <SummaryTile label="Staff" value={counts.staff} tone="neutral" />
      </div>

      <FilterBar filters={filters} setFilter={setFilter} />

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
          {viewMode === "table" ? (
            <UserTable
              items={data.items}
              onEdit={openEdit}
              onDeactivate={(u) => setPendingDeactivate(u)}
              onReactivate={(u) => reactivate.mutate(u.id)}
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

function FilterBar({
  filters,
  setFilter,
}: {
  filters: UserFilters;
  setFilter: (patch: Partial<UserFilters>) => void;
}) {
  return (
    <Card className="mb-4">
      <CardContent className="p-3 flex flex-wrap items-center gap-2">
        <FilterGroupLabel>Role</FilterGroupLabel>
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

        <Divider />

        <FilterGroupLabel>Status</FilterGroupLabel>
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
      </CardContent>
    </Card>
  );
}

function FilterGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold px-2">
      {children}
    </span>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-border mx-2" />;
}

/* -------------------------------------------------------------------------- */

function UserTable({
  items,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  items: AppUser[];
  onEdit: (u: AppUser) => void;
  onDeactivate: (u: AppUser) => void;
  onReactivate: (u: AppUser) => void;
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
}: {
  user: AppUser;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
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
