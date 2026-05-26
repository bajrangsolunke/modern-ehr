import { Bell, ChevronDown, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/mocks";
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
          <div className="font-display text-[22px] font-bold tracking-tight">
            Symptra
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-1 mx-auto bg-[#F1F4F9] rounded-full p-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "px-4 xl:px-5 py-2 rounded-full text-[14px] font-medium transition-all",
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
          <Button
            variant="ghost"
            size="icon"
            className="relative size-10 rounded-full bg-[#F1F4F9] hover:bg-[#E6EBF2] text-slate-700"
          >
            <Bell className="size-[18px]" />
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 grid place-items-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-white">
              3
            </span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full bg-[#F1F4F9] hover:bg-[#E6EBF2] text-slate-700"
          >
            <Settings className="size-[18px]" />
          </Button>
          <div className="flex items-center gap-2.5 pl-2 ml-1 h-10">
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
