import { ReactNode, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/query-client";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { registerAuthListeners } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/lib/toast";

interface Props {
  children: ReactNode;
}

function AuthListenerBridge() {
  const qc = useQueryClient();
  const setDemoMode = useAuthStore((s) => s.setDemoMode);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    registerAuthListeners({
      onDemoModeChange: (active) => setDemoMode(active),
      onLogout: () => {
        logout();
        qc.clear();
      },
      onFirstFallback: () =>
        toast.warning("Backend unreachable", {
          description:
            "Showing demo data. Some actions won't persist until the backend comes back.",
        }),
    });
  }, [qc, setDemoMode, logout]);

  return null;
}

export function AppProviders({ children }: Props) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={150}>
          <BrowserRouter>
            <AuthListenerBridge />
            {children}
            <Toaster
              position="top-right"
              richColors
              closeButton
              duration={4000}
              toastOptions={{ style: { borderRadius: "12px" } }}
            />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
