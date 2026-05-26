import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

export function PublicRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const demoModeActive = useAuthStore((s) => s.demoModeActive);

  if (accessToken || demoModeActive) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
