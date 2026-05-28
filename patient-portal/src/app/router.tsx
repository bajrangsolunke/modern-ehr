import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";
import { LoginPage } from "@/features/auth/LoginPage";
import { SetupPage } from "@/features/auth/SetupPage";
import { ResetPage } from "@/features/auth/ResetPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { PublicRoute } from "@/features/auth/components/PublicRoute";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { ROUTES } from "@/config/constants";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.setup} element={<SetupPage />} />
        <Route path={ROUTES.reset} element={<ResetPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<Shell />}>
          <Route path={ROUTES.dashboard} element={<DashboardPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
    </Routes>
  );
}
