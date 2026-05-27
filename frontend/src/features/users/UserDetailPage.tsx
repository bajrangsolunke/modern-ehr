/**
 * Admin-only user detail page (US-7).
 * Surfaces the user's profile, role, status, and aggregate activity:
 * patients they're assigned to, upcoming / completed appointment
 * counts, and a recent appointments table. Availability is reserved
 * for a future scheduling story.
 */
import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  Mail,
  Pencil,
  ShieldOff,
  Users as UsersIcon,
  UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SummaryTile } from "@/components/ui/summary-tile";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UserAvatar } from "@/components/ui/avatar";
import { UserDrawer } from "@/features/users/components/UserDrawer";
import {
  useDeactivateUser,
  useReactivateUser,
  useUser,
  useUserAppointments,
  useUserStats,
} from "@/features/users/hooks/use-users";
import { usePatients } from "@/features/patients/hooks/use-patients";
import { useAvailability } from "@/features/settings/hooks/use-availability";
import { AvailabilityEditor } from "@/features/settings/components/AvailabilityEditor";
import type { Role } from "@/types";
import { cn, formatDate, formatTime } from "@/lib/utils";

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

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState(false);

  const { data: user, isLoading, isError, error, refetch, isFetching } = useUser(userId);
  const { data: stats } = useUserStats(userId);
  const { data: appointments } = useUserAppointments(userId);
  const { data: patients } = usePatients({
    physician_id: userId,
    page: 1,
    page_size: 5,
  });
  const { data: availability } = useAvailability(userId);
  const reactivate = useReactivateUser();
  const deactivate = useDeactivateUser();

  const weeklyHours = availability
    ? availability
        .filter((s) => s.isActive)
        .reduce((sum, s) => {
          const [sh, sm] = s.startTime.split(":").map(Number);
          const [eh, em] = s.endTime.split(":").map(Number);
          return sum + Math.max(0, eh * 60 + em - (sh * 60 + sm));
        }, 0) / 60
    : null;
  const isProvider = user?.role === "provider";

  return (
    <>
      <PageHeader
        title="User profile"
        back
        onBack={() => navigate(-1)}
        right={
          user && (
            <>
              <Button
                variant="secondary"
                className="h-10"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-4" /> Edit
              </Button>
              {user.isActive ? (
                <Button
                  variant="secondary"
                  className="h-10 text-danger hover:text-danger"
                  onClick={() => setPendingDeactivate(true)}
                >
                  <ShieldOff className="size-4" /> Deactivate
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="h-10 text-success hover:text-success"
                  onClick={() => reactivate.mutate(user.id)}
                  disabled={reactivate.isPending}
                >
                  {reactivate.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserCheck className="size-4" />
                  )}{" "}
                  Reactivate
                </Button>
              )}
            </>
          )
        }
      />

      {isLoading && <DetailSkeleton />}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load user"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && user && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-5 flex-wrap">
                <UserAvatar
                  name={user.fullName}
                  src={user.avatarUrl ?? undefined}
                  size="xl"
                  className="size-20 text-xl"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-bold tracking-tight truncate">
                      {user.fullName}
                    </h2>
                    <Badge variant={roleVariant[user.role]} size="sm">
                      {roleLabel[user.role]}
                    </Badge>
                    {user.isActive ? (
                      <Badge variant="success" dot size="sm">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="neutral" dot size="sm">
                        Deactivated
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-muted-foreground flex-wrap">
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="size-3.5" />
                      <a
                        href={`mailto:${user.email}`}
                        className="hover:text-foreground"
                      >
                        {user.email}
                      </a>
                    </span>
                    {user.specialty && (
                      <>
                        <span className="text-border">·</span>
                        <span>{user.specialty}</span>
                      </>
                    )}
                    <span className="text-border">·</span>
                    <span>Joined {formatDate(user.createdAt)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
            <SummaryTile
              label="Assigned patients"
              value={stats?.patientCount ?? "—"}
              icon={<UsersIcon />}
              tone="info"
            />
            <SummaryTile
              label="Upcoming appointments"
              value={stats?.upcomingAppointments ?? "—"}
              icon={<CalendarClock />}
              tone="primary"
            />
            <SummaryTile
              label="Completed appointments"
              value={stats?.completedAppointments ?? "—"}
              icon={<CheckCircle2 />}
              tone="success"
            />
            <SummaryTile
              label="Weekly hours"
              value={
                weeklyHours === null
                  ? "—"
                  : weeklyHours === 0
                  ? "0"
                  : `${weeklyHours.toFixed(1)}`
              }
              hint={
                isProvider
                  ? `${availability?.filter((s) => s.isActive).length ?? 0} active slots`
                  : "Providers only"
              }
              tone="muted"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle>Recent appointments</CardTitle>
                {appointments && appointments.length > 0 && (
                  <Badge variant="neutral" size="sm">
                    {appointments.length}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="pb-5">
                {!appointments && <Skeleton className="h-24 rounded-xl" />}
                {appointments && appointments.length === 0 && (
                  <div className="text-sm text-muted-foreground py-6 text-center rounded-xl bg-surface-subtle">
                    No appointments on record.
                  </div>
                )}
                {appointments && appointments.length > 0 && (
                  <ul className="space-y-2">
                    {appointments.slice(0, 6).map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-surface-subtle px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold capitalize truncate">
                            {a.type.replace(/_/g, " ")}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatDate(a.startsAt)} · {formatTime(a.startsAt)}
                            {a.room ? ` · ${a.room}` : ""}
                          </div>
                        </div>
                        <Badge
                          variant={statusVariant(a.status)}
                          size="sm"
                          className="capitalize shrink-0"
                        >
                          {a.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle>Assigned patients</CardTitle>
                {patients && patients.total > 0 && (
                  <Badge variant="neutral" size="sm">
                    {patients.total}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="pb-5">
                {!patients && <Skeleton className="h-24 rounded-xl" />}
                {patients && patients.items.length === 0 && (
                  <div className="text-sm text-muted-foreground py-6 text-center rounded-xl bg-surface-subtle">
                    {user.role === "provider"
                      ? "No patients are currently assigned."
                      : "Only providers carry a patient list."}
                  </div>
                )}
                {patients && patients.items.length > 0 && (
                  <ul className="space-y-2">
                    {patients.items.map((p) => (
                      <li key={p.id}>
                        <Link
                          to={`/patients/${p.id}`}
                          className="flex items-center justify-between gap-3 rounded-xl bg-surface-subtle px-3 py-2 hover:bg-surface-subtle/70 transition"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <UserAvatar
                              name={p.name}
                              src={p.avatarUrl}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">
                                {p.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                MRN {p.mrn}
                                {p.procedure ? ` · ${p.procedure}` : ""}
                              </div>
                            </div>
                          </div>
                          <Badge variant="neutral" size="sm" className="capitalize">
                            {p.status}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {patients && patients.total > patients.items.length && (
                  <Link
                    to={`/patients?physician_id=${user.id}`}
                    className="block text-center text-xs text-primary font-semibold mt-3 hover:underline"
                  >
                    See all {patients.total} patients →
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>

          {isProvider && (
            <AvailabilityEditor
              userId={user.id}
              description="Hours this provider is available for appointments. Admins can edit on their behalf."
            />
          )}
        </div>
      )}

      <UserDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        user={user ?? undefined}
      />

      <ConfirmDialog
        open={pendingDeactivate}
        onOpenChange={setPendingDeactivate}
        title={user ? `Deactivate ${user.fullName}?` : "Deactivate user?"}
        description="The user won't be able to sign in. Their audit history stays intact and an admin can reactivate them later."
        confirmLabel="Deactivate"
        destructive
        busy={deactivate.isPending}
        onConfirm={async () => {
          if (!user) return;
          await deactivate.mutateAsync(user.id);
          setPendingDeactivate(false);
        }}
      />
    </>
  );
}


function statusVariant(
  status: string
): "info" | "warning" | "success" | "neutral" | "danger" {
  switch (status) {
    case "confirmed":
      return "info";
    case "pending":
      return "warning";
    case "completed":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 flex items-start gap-5">
          <Skeleton className="size-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-64 rounded-full" />
            <Skeleton className="h-3 w-40 rounded-full" />
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}
