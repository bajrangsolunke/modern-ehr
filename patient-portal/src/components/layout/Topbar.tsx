import {
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  User as UserIcon,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { ROUTES } from "@/config/constants";
import { useMessagesSocket } from "@/features/messages/hooks/use-messages-socket";
import { cn } from "@/lib/utils";

interface NavLeaf {
  to: string;
  label: string;
  end?: boolean;
}

const navItems: NavLeaf[] = [
  { to: ROUTES.dashboard, label: "Dashboard", end: true },
  { to: ROUTES.messages, label: "Communication" },
  { to: ROUTES.appointments, label: "Appointments" },
  { to: ROUTES.docs, label: "Docs" },
  { to: ROUTES.tasks, label: "Tasks" },
  { to: ROUTES.notifications, label: "Notifications" },
];

export function Topbar() {
  const me = useAuthStore((s) => s.me);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  // Keep a single WS connection alive while signed-in; new messages
  // invalidate React Query so the UI updates without a refresh.
  useMessagesSocket();
  const displayName = me ? `${me.first_name} ${me.last_name}`.trim() : "Patient";
  const displayEmail = me?.email ?? "";

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
          <div className="flex flex-col leading-none">
            <span className="font-display text-[20px] font-bold tracking-tight">
              Modern-EHR
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary mt-0.5">
              AI-Native
            </span>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-1 mx-auto bg-[#F1F4F9] rounded-full p-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
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
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 min-w-fit">
          <Popover.Root>
            <Popover.Trigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative size-10 rounded-full bg-[#F1F4F9] hover:bg-[#E6EBF2] text-slate-700"
                aria-label="Notifications"
              >
                <Bell className="size-[18px]" />
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
                  You're all caught up. Real-time notifications coming soon.
                </p>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full bg-[#F1F4F9] hover:bg-[#E6EBF2] text-slate-700"
            aria-label="Settings"
            onClick={() => navigate(ROUTES.settings)}
          >
            <Settings className="size-[18px]" />
          </Button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-2.5 pl-1 pr-3 ml-1 h-11 rounded-full bg-[#F1F4F9] hover:bg-[#E6EBF2] transition ring-focus">
                <UserAvatar
                  name={displayName}
                  size="md"
                  variant="gradient"
                  className="ring-2 ring-white shadow-glow"
                />
                <div className="hidden sm:flex flex-col leading-tight text-left">
                  <span className="text-sm font-bold">{displayName}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                    {displayEmail || "Patient"}
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
                  onSelect={() => navigate(ROUTES.settings)}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-secondary cursor-pointer outline-none"
                >
                  <UserIcon className="size-4 text-muted-foreground" />
                  Profile
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => navigate(ROUTES.settings)}
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
