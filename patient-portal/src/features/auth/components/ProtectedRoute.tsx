import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { ROUTES } from "@/config/constants";
import { useMe } from "@/features/auth/hooks/use-me";
import { Spinner } from "@/components/ui/Spinner";

export function ProtectedRoute() {
  const token = useAuthStore((s) => s.accessToken);
  const { isLoading, isError } = useMe();

  if (!token) return <Navigate to={ROUTES.login} replace />;
  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }
  if (isError) return <Navigate to={ROUTES.login} replace />;
  return <Outlet />;
}
