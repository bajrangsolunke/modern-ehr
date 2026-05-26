import { Bell, ChevronDown, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/data/mock";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/patients", label: "Patients" },
  { to: "/insights", label: "Insights" },
  { to: "/appointments", label: "Appointments" },
  { to: "/docs", label: "Docs" },
  { to: "/team", label: "Team" },
  { to: "/mobile", label: "Mobile" },
];

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-border">
      <div className="mx-auto w-full max-w-[1720px] flex items-center justify-between gap-4 px-5 sm:px-6 lg:px-8 3xl:px-10 h-[72px]">
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
          <div className="font-display text-[22px] font-bold tracking-tight">
            Symptra
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-1 mx-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "px-5 py-2 rounded-full text-[15px] font-medium transition-all",
                  isActive
                    ? "bg-slate-900 text-white shadow-soft"
                    : "text-slate-600 hover:text-slate-900"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3 min-w-fit">
          <Button
            variant="ghost"
            size="icon"
            className="relative size-10 rounded-full bg-white border border-border hover:border-primary/40"
          >
            <Bell className="size-4" />
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 grid place-items-center rounded-full bg-danger text-[10px] font-bold text-white">
              3
            </span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full bg-white border border-border hover:border-primary/40"
          >
            <Settings className="size-4" />
          </Button>
          <div className="flex items-center gap-2 pl-2 ml-1 border-l border-border h-10">
            <UserAvatar
              name={currentUser.name}
              size="md"
              className="bg-amber-100 ring-2 ring-amber-50"
            />
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="text-sm font-bold">{currentUser.name}</span>
              <span className="text-xs text-muted-foreground capitalize">
                {currentUser.role}
              </span>
            </div>
            <ChevronDown className="size-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </header>
  );
}
