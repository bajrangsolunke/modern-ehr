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
              position="bottom-right"
              closeButton
              duration={4000}
              theme="light"
              visibleToasts={4}
              offset={20}
              gap={10}
              expand={false}
              toastOptions={{
                unstyled: false,
                classNames: {
                  // Card-style toast that matches the rest of the app.
                  toast:
                    "group !rounded-2xl !border !border-border !bg-white !text-foreground !shadow-elev !p-4 !gap-3 !items-start",
                  title: "!text-sm !font-semibold !leading-snug !text-foreground",
                  description:
                    "!text-xs !leading-relaxed !text-muted-foreground !mt-0.5",
                  closeButton:
                    "!bg-white !border !border-border !text-muted-foreground hover:!text-foreground !rounded-full !left-auto !right-2 !top-2",
                  // Severity bars + icon backgrounds.
                  success:
                    "[&_[data-icon]]:!bg-success/10 [&_[data-icon]]:!text-success",
                  error:
                    "[&_[data-icon]]:!bg-danger/10 [&_[data-icon]]:!text-danger",
                  warning:
                    "[&_[data-icon]]:!bg-warning/10 [&_[data-icon]]:!text-warning",
                  info: "[&_[data-icon]]:!bg-info/10 [&_[data-icon]]:!text-info",
                },
              }}
            />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
