import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useMe } from "@/features/auth/hooks/use-me";
import { ROUTES } from "@/config/constants";

export function ProtectedRoute() {
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const me = useAuthStore((s) => s.me);
  const { isLoading, isError } = useMe();

  if (!accessToken) {
    return <Navigate to={ROUTES.login} state={{ from: location }} replace />;
  }
  if (isLoading && !me) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  if (isError && !me) {
    return <Navigate to={ROUTES.login} state={{ from: location }} replace />;
  }
  return <Outlet />;
}
