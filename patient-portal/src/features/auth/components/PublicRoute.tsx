import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { ROUTES } from "@/config/constants";

export function PublicRoute() {
  const token = useAuthStore((s) => s.accessToken);
  if (token) return <Navigate to={ROUTES.dashboard} replace />;
  return <Outlet />;
}
