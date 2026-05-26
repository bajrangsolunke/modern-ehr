import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const qc = useQueryClient();
  const navigate = useNavigate();

  return () => {
    logout();
    qc.clear();
    navigate("/login", { replace: true });
  };
}
