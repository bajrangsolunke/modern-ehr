import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";
import { ProtectedRoute, PublicRoute } from "@/components/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { ROUTES } from "@/config/constants";
import { currentUser as mockUser } from "@/mocks";

/*
 * Every page below is route-lazy so the initial JS payload is just
 * the shell, auth wiring, providers, and React Query — pages load
 * on demand. Vite emits one chunk per dynamic import (see
 * vite.config.ts for the vendor split).
 */
const LoginPage = lazy(() =>
  import("@/features/auth").then((m) => ({ default: m.LoginPage }))
);
const SetupPage = lazy(() =>
  import("@/features/auth").then((m) => ({ default: m.SetupPage }))
);
const DashboardPage = lazy(() =>
  import("@/features/dashboard").then((m) => ({ default: m.DashboardPage }))
);
const PatientsPage = lazy(() =>
  import("@/features/patients").then((m) => ({ default: m.PatientsPage }))
);
const PatientProfilePage = lazy(() =>
  import("@/features/patients").then((m) => ({ default: m.PatientProfilePage }))
);
const InsightsPage = lazy(() =>
  import("@/features/analytics").then((m) => ({ default: m.InsightsPage }))
);
const ReportsLayout = lazy(() =>
  import("@/features/reports").then((m) => ({ default: m.ReportsLayout }))
);
const MessagesPage = lazy(() =>
  import("@/features/messages").then((m) => ({ default: m.MessagesPage }))
);
const AppointmentsPage = lazy(() =>
  import("@/features/appointments").then((m) => ({ default: m.AppointmentsPage }))
);
const TasksPage = lazy(() =>
  import("@/features/tasks").then((m) => ({ default: m.TasksPage }))
);
const UsersPage = lazy(() =>
  import("@/features/users").then((m) => ({ default: m.UsersPage }))
);
const UserDetailPage = lazy(() =>
  import("@/features/users").then((m) => ({ default: m.UserDetailPage }))
);
const DocsPage = lazy(() =>
  import("@/features/docs").then((m) => ({ default: m.DocsPage }))
);
const FormsPage = lazy(() =>
  import("@/features/forms").then((m) => ({ default: m.FormsPage }))
);
const FormEditorPage = lazy(() =>
  import("@/features/forms").then((m) => ({ default: m.FormEditorPage }))
);
const SettingsPage = lazy(() =>
  import("@/features/settings").then((m) => ({ default: m.SettingsPage }))
);
const ServicesCatalogPage = lazy(() =>
  import("@/features/billing").then((m) => ({ default: m.ServicesCatalogPage }))
);
const SoapNotePage = lazy(() =>
  import("@/features/notes").then((m) => ({ default: m.SoapNotePage }))
);
const ProviderTelehealthPage = lazy(() =>
  import("@/features/telehealth/ProviderTelehealthPage").then((m) => ({
    default: m.ProviderTelehealthPage,
  }))
);

function PageFallback() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-64 rounded-full" />
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
          {/* Staff account setup — token IS the auth; no bearer needed. */}
          <Route path="/setup" element={<SetupPage />} />
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
            <Route path="/patients/:patientId/notes/new" element={<SoapNotePage />} />
            <Route path="/patients/:patientId/notes/:noteId" element={<SoapNotePage />} />
            <Route path={ROUTES.messages} element={<MessagesPage />} />
            <Route path={ROUTES.reports} element={<ReportsLayout />}>
              <Route
                index
                element={<Navigate to={ROUTES.reportsInsights} replace />}
              />
              <Route path="insights" element={<InsightsPage />} />
            </Route>
            {/* Legacy /insights bookmark → reports/insights. */}
            <Route
              path="/insights"
              element={<Navigate to={ROUTES.reportsInsights} replace />}
            />
            <Route path={ROUTES.appointments} element={<AppointmentsPage />} />
            <Route path={ROUTES.forms} element={<FormsPage />} />
            <Route path="/forms/:formId/edit" element={<FormEditorPage />} />
            <Route path={ROUTES.docs} element={<DocsPage />} />
            <Route element={<AdminRoute />}>
              <Route path={ROUTES.users} element={<UsersPage />} />
              <Route path="/users/:userId" element={<UserDetailPage />} />
              <Route path="/settings/services" element={<ServicesCatalogPage />} />
            </Route>
            <Route path={ROUTES.settings} element={<SettingsPage />} />
            {/* Legacy /team redirects to /users for bookmarked links. */}
            <Route path="/team" element={<Navigate to={ROUTES.users} replace />} />
            <Route path={ROUTES.tasks} element={<TasksPage />} />
          </Route>
          {/* Telehealth lives OUTSIDE the Shell — full viewport, no
              sidebar/topbar chrome. Auth still required. */}
          <Route
            path="/visits/telehealth/:appointmentId"
            element={<ProviderTelehealthPage />}
          />
        </Route>

        <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
      </Routes>
    </Suspense>
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
