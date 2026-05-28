import { LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/Button";

export function Header() {
  const me = useAuthStore((s) => s.me);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="border-b border-border bg-surface">
      <div className="max-w-column mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-full bg-primary grid place-items-center text-primary-foreground font-bold">
            P
          </div>
          <span className="font-bold text-foreground">Padmavat</span>
        </div>
        {me && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">
              Hi, {me.first_name}
            </span>
            <Button
              variant="ghost"
              size="md"
              onClick={logout}
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
