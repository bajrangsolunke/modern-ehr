import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";
import { ProtectedRoute, PublicRoute } from "@/components/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/config/constants";

const LoginPage = lazy(() =>
  import("@/features/auth").then((m) => ({ default: m.LoginPage }))
);
const SetupPage = lazy(() =>
  import("@/features/auth").then((m) => ({ default: m.SetupPage }))
);
const ResetPage = lazy(() =>
  import("@/features/auth").then((m) => ({ default: m.ResetPage }))
);
const DashboardPage = lazy(() =>
  import("@/features/dashboard").then((m) => ({ default: m.DashboardPage }))
);
const MessagesPage = lazy(() =>
  import("@/features/messages").then((m) => ({ default: m.MessagesPage }))
);
const AppointmentsPage = lazy(() =>
  import("@/features/appointments").then((m) => ({ default: m.AppointmentsPage }))
);
const DocsPage = lazy(() =>
  import("@/features/docs").then((m) => ({ default: m.DocsPage }))
);
const TasksPage = lazy(() =>
  import("@/features/tasks").then((m) => ({ default: m.TasksPage }))
);
const NotificationsPage = lazy(() =>
  import("@/features/notifications").then((m) => ({ default: m.NotificationsPage }))
);
const SettingsPage = lazy(() =>
  import("@/features/settings").then((m) => ({ default: m.SettingsPage }))
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
          <Route path={ROUTES.login} element={<LoginPage />} />
          <Route path={ROUTES.setup} element={<SetupPage />} />
          <Route path={ROUTES.reset} element={<ResetPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<Shell />}>
            <Route path={ROUTES.dashboard} element={<DashboardPage />} />
            <Route path={ROUTES.messages} element={<MessagesPage />} />
            <Route path={ROUTES.appointments} element={<AppointmentsPage />} />
            <Route path={ROUTES.docs} element={<DocsPage />} />
            <Route path={ROUTES.tasks} element={<TasksPage />} />
            <Route path={ROUTES.notifications} element={<NotificationsPage />} />
            <Route path={ROUTES.settings} element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
      </Routes>
    </Suspense>
  );
}
