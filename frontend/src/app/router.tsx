import { Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";
import { ProtectedRoute, PublicRoute } from "@/components/auth";
import { LoginPage } from "@/features/auth";
import { DashboardPage } from "@/features/dashboard";
import { PatientsPage, PatientProfilePage } from "@/features/patients";
import { InsightsPage } from "@/features/analytics";
import { AppointmentsPage } from "@/features/appointments";
import { MobilePage } from "@/features/mobile";
import { UsersPage, UserDetailPage } from "@/features/users";
import { SettingsPage } from "@/features/settings";
import { useAuthStore } from "@/stores/auth-store";
import { ROUTES } from "@/config/constants";
import { currentUser as mockUser } from "@/mocks";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<Shell />}>
          <Route path={ROUTES.dashboard} element={<DashboardPage />} />
          <Route path={ROUTES.patients} element={<PatientsPage />} />
          {/* /patients/new and /patients/:id/edit are now drawers on the
              listing and profile pages; redirect stale bookmarks. */}
          <Route
            path="/patients/new"
            element={<Navigate to={ROUTES.patients} replace />}
          />
          <Route path="/patients/:patientId" element={<PatientProfilePage />} />
          <Route path="/patients/:patientId/edit" element={<EditRedirect />} />
          <Route path={ROUTES.insights} element={<InsightsPage />} />
          <Route path={ROUTES.appointments} element={<AppointmentsPage />} />
          <Route path={ROUTES.docs} element={<Placeholder title="Docs" />} />
          <Route element={<AdminRoute />}>
            <Route path={ROUTES.users} element={<UsersPage />} />
            <Route path="/users/:userId" element={<UserDetailPage />} />
          </Route>
          <Route path={ROUTES.settings} element={<SettingsPage />} />
          {/* Legacy /team redirects to /users for bookmarked links. */}
          <Route path="/team" element={<Navigate to={ROUTES.users} replace />} />
          <Route path={ROUTES.mobile} element={<MobilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
    </Routes>
  );
}

function EditRedirect() {
  const { patientId } = useParams();
  return <Navigate to={`/patients/${patientId}`} replace />;
}

/**
 * Route gate: only admins pass through. Anyone else bounces to the
 * dashboard. Used for the /users management page.
 */
function AdminRoute() {
  const user = useAuthStore((s) => s.user) ?? mockUser;
  if (user.role !== "admin") {
    return <Navigate to={ROUTES.dashboard} replace />;
  }
  return <Outlet />;
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-subtle p-12 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">
        This module is part of the platform scaffold and will be wired to live data shortly.
      </p>
    </div>
  );
}
