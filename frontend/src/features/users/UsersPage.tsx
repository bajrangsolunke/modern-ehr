/**
 * Users management page (admin-only).
 *
 * User stories satisfied here:
 * - US-1 (admin sees all users with role, status, search/filter)
 * - US-2 (admin invites a new user)
 * - US-3 (admin edits a user)
 * - US-4 (admin deactivates a user — soft delete)
 *
 * US-5 (route gating) is handled in app/router.tsx via <AdminRoute />.
 */
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Pencil,
  Plus,
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
import { UserDrawer } from "@/features/users/components/UserDrawer";
import {
  useDeactivateUser,
  useReactivateUser,
  useUsers,
} from "@/features/users/hooks/use-users";
import type { AppUser, UserFilters } from "@/features/users/api/users-api";
import type { Role } from "@/types";
import { cn, formatDate } from "@/lib/utils";

const ROW_BG = "#F5F7FB";
const HEADER_BG = "#FFFFFF";
const HEADER_SHADOW = "0 4px 12px rgba(17,24,39,0.06)";

const roleLabel: Record<Role, string> = {
  provider: "Provider",
  staff: "Staff",
  admin: "Admin",
};

const roleVariant: Record<Role, "info" | "neutral" | "danger"> = {
  provider: "info",
  staff: "neutral",
  admin: "danger",
};

export function UsersPage() {
  const [filters, setFilters] = useState<UserFilters>({ page: 1, page_size: 20 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<AppUser | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useUsers(filters);
  const reactivate = useReactivateUser();
  const deactivate = useDeactivateUser();

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (u: AppUser) => {
    setEditing(u);
    setDrawerOpen(true);
  };

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

      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold px-2">
            Role
          </span>
          <RoleChip
            label="All"
            active={filters.role === undefined}
            onClick={() => setFilter({ role: undefined })}
          />
          {(Object.keys(roleLabel) as Role[]).map((r) => (
            <RoleChip
              key={r}
              label={roleLabel[r]}
              active={filters.role === r}
              onClick={() => setFilter({ role: r })}
            />
          ))}

          <div className="w-px h-6 bg-border mx-2" />

          <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold px-2">
            Status
          </span>
          <StatusChip
            label="Active"
            tone="success"
            active={filters.is_active === true}
            onClick={() =>
              setFilter({
                is_active: filters.is_active === true ? undefined : true,
              })
            }
          />
          <StatusChip
            label="Deactivated"
            tone="muted"
            active={filters.is_active === false}
            onClick={() =>
              setFilter({
                is_active: filters.is_active === false ? undefined : false,
              })
            }
          />
        </CardContent>
      </Card>

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
          <Card className="overflow-hidden p-3 sm:p-4">
            <div className="overflow-x-auto">
              <table
                className="w-full text-sm border-separate"
                style={{ borderSpacing: "0 6px" }}
              >
                <thead>
                  <tr className="text-xs text-muted-foreground text-left">
                    <Th first>Name</Th>
                    <Th>Email</Th>
                    <Th>Role</Th>
                    <Th>Specialty</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                    <th
                      className="font-medium px-4 py-2 text-right last:rounded-r-full"
                      style={{ background: HEADER_BG, boxShadow: HEADER_SHADOW }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-muted-foreground rounded-2xl"
                        style={{ background: ROW_BG }}
                      >
                        No users match these filters.
                      </td>
                    </tr>
                  )}
                  {data.items.map((u) => (
                    <tr
                      key={u.id}
                      className={cn(
                        "hover:[&_td]:bg-[#EEF2F8] transition group",
                        !u.isActive && "opacity-60"
                      )}
                    >
                      <td
                        className="px-4 py-2 first:rounded-l-full"
                        style={{ background: ROW_BG }}
                      >
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            name={u.fullName}
                            src={u.avatarUrl ?? undefined}
                            size="sm"
                          />
                          <span className="font-semibold">{u.fullName}</span>
                        </div>
                      </td>
                      <td
                        className="px-4 py-2 text-foreground/80"
                        style={{ background: ROW_BG }}
                      >
                        {u.email}
                      </td>
                      <td className="px-4 py-2" style={{ background: ROW_BG }}>
                        <Badge variant={roleVariant[u.role]} size="sm">
                          {roleLabel[u.role]}
                        </Badge>
                      </td>
                      <td
                        className="px-4 py-2 text-foreground/80"
                        style={{ background: ROW_BG }}
                      >
                        {u.specialty || "—"}
                      </td>
                      <td className="px-4 py-2" style={{ background: ROW_BG }}>
                        {u.isActive ? (
                          <Badge variant="success" dot size="sm">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="neutral" dot size="sm">
                            Deactivated
                          </Badge>
                        )}
                      </td>
                      <td
                        className="px-4 py-2 text-foreground/80"
                        style={{ background: ROW_BG }}
                      >
                        {formatDate(u.createdAt)}
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
                            aria-label="Edit user"
                            onClick={() => openEdit(u)}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          {u.isActive ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 rounded-full bg-white hover:bg-rose-50 text-danger"
                              aria-label="Deactivate user"
                              onClick={() => setPendingDeactivate(u)}
                            >
                              <ShieldOff className="size-3" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 rounded-full bg-white hover:bg-emerald-50 text-success"
                              aria-label="Reactivate user"
                              onClick={() => reactivate.mutate(u.id)}
                            >
                              <UserCheck className="size-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
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

function RoleChip({
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

function StatusChip({
  label,
  tone,
  active,
  onClick,
}: {
  label: string;
  tone: "success" | "muted";
  active: boolean;
  onClick: () => void;
}) {
  const dot = tone === "success" ? "bg-success" : "bg-slate-400";
  const activeRing =
    tone === "success"
      ? "border-success/40 bg-success/10 text-success"
      : "border-slate-400/40 bg-slate-100 text-slate-700";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium border bg-white transition ring-focus",
        active
          ? activeRing
          : "border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </button>
  );
}

function SummaryTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: "info" | "neutral" | "danger";
}) {
  const toneClass =
    tone === "info"
      ? "text-info"
      : tone === "danger"
      ? "text-danger"
      : tone === "neutral"
      ? "text-muted-foreground"
      : "text-primary";
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        {icon && (
          <div
            className={cn(
              "size-10 rounded-2xl bg-surface-subtle grid place-items-center",
              toneClass
            )}
          >
            <span className="[&_svg]:size-5">{icon}</span>
          </div>
        )}
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            {label}
          </div>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Pagination({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (pages <= 1) {
    return (
      <div className="mt-4 text-xs text-muted-foreground text-right">
        Showing {total} {total === 1 ? "user" : "users"}.
      </div>
    );
  }
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-xs text-muted-foreground">
        Page {page} of {pages} · {total} users
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="icon"
          className="size-9 rounded-full"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="size-9 rounded-full"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
