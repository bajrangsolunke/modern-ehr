import { Bell, ChevronDown, LogOut, Settings, User as UserIcon } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { DemoBadge } from "@/features/auth/components/DemoBadge";
import { useUnreadCount } from "@/features/messages/hooks/use-unread-count";
import { useMessagesSocket } from "@/features/messages/hooks/use-messages-socket";
import { currentUser as mockUser } from "@/mocks";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  /** When set, the item only renders for users whose role is in the list. */
  roles?: ("provider" | "staff" | "admin")[];
  /** Hook returning a count to render as a badge next to the label. */
  useBadge?: () => number;
}

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard" },
  { to: "/patients", label: "Patients" },
  { to: "/messages", label: "Communication", useBadge: useUnreadCount },
  { to: "/appointments", label: "Appointments" },
  { to: "/docs", label: "Docs" },
  { to: "/reports", label: "Reports" },
  { to: "/users", label: "Users", roles: ["admin"] },
  { to: "/mobile", label: "Mobile" },
];

export function Topbar() {
  const user = useAuthStore((s) => s.user) ?? mockUser;
  const logout = useLogout();
  const navigate = useNavigate();
  // App-wide subscription — keeps the unread badge live even while the
  // user isn't on the Messages page.
  useMessagesSocket();
  const visibleNav = navItems.filter(
    (item) => !item.roles || item.roles.includes(user.role)
  );

  return (
    <header className="rounded-[28px] bg-white border border-border/70 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
      <div className="flex items-center justify-between gap-4 px-5 sm:px-6 lg:px-7 3xl:px-8 h-[72px]">
        <div className="flex items-center gap-3 min-w-fit">
          <div className="size-11 rounded-full bg-primary-gradient grid place-items-center text-white shadow-glow">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 2v14M2 9h14"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="font-display text-[22px] font-bold tracking-tight">Padmavat</div>
        </div>

        <nav className="hidden lg:flex items-center gap-1 mx-auto bg-[#F1F4F9] rounded-full p-1">
          {visibleNav.map((item) => (
            <NavItemLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="flex items-center gap-2 min-w-fit">
          <DemoBadge />

          <Popover.Root>
            <Popover.Trigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative size-10 rounded-full bg-[#F1F4F9] hover:bg-[#E6EBF2] text-slate-700"
                aria-label="Notifications"
              >
                <Bell className="size-[18px]" />
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 grid place-items-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-white">
                  3
                </span>
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                sideOffset={8}
                align="end"
                className="z-50 w-80 rounded-2xl bg-white shadow-elev border border-border p-4 animate-fade-in"
              >
                <h3 className="font-semibold text-sm mb-2">Notifications</h3>
                <p className="text-xs text-muted-foreground">
                  Real-time notifications arrive in Phase C. Until then this is a
                  placeholder.
                </p>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full bg-[#F1F4F9] hover:bg-[#E6EBF2] text-slate-700"
            aria-label="Settings"
            onClick={() => navigate("/settings")}
          >
            <Settings className="size-[18px]" />
          </Button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-2.5 pl-2 ml-1 h-10 ring-focus rounded-full">
                <UserAvatar
                  name={user.name}
                  size="md"
                  className="bg-amber-100 ring-2 ring-amber-50"
                />
                <div className="hidden sm:flex flex-col leading-tight text-left">
                  <span className="text-sm font-bold">{user.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {user.role}
                  </span>
                </div>
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                sideOffset={8}
                align="end"
                className="z-50 w-56 rounded-2xl bg-white shadow-elev border border-border p-1.5 animate-fade-in"
              >
                <DropdownMenu.Item
                  onSelect={() => navigate("/settings")}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-secondary cursor-pointer outline-none"
                >
                  <UserIcon className="size-4 text-muted-foreground" />
                  Profile
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => navigate("/settings?tab=security")}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-secondary cursor-pointer outline-none"
                >
                  <Settings className="size-4 text-muted-foreground" />
                  Settings
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-border my-1" />
                <DropdownMenu.Item
                  onSelect={() => logout()}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-danger/10 text-danger cursor-pointer outline-none"
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </header>
  );
}

function NavItemLink({ item }: { item: NavItem }) {
  // Hooks must be called unconditionally; default to a no-op badge.
  const badge = (item.useBadge ?? (() => 0))();
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        cn(
          "px-4 xl:px-5 py-2 rounded-full text-[14px] font-medium transition-all inline-flex items-center gap-2",
          isActive
            ? "bg-slate-900 text-white shadow-soft"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
        )
      }
    >
      {item.label}
      {badge > 0 && (
        <span className="inline-grid place-items-center min-w-5 h-5 px-1.5 rounded-full bg-danger text-white text-[10px] font-bold tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </NavLink>
  );
}
