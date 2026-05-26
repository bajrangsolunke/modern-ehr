import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { PageSpinner } from "@/components/feedback/Spinner";

export function ProtectedRoute() {
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const demoModeActive = useAuthStore((s) => s.demoModeActive);

  const { isLoading, isError } = useCurrentUser();

  // No token and not demo mode → straight to login
  if (!accessToken && !demoModeActive) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Have a token but still resolving the user — show a spinner once
  if (isLoading && !user) return <PageSpinner label="Loading session…" />;

  // Token rejected, no user resolved, not in demo mode → bounce
  if (isError && !user && !demoModeActive) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
