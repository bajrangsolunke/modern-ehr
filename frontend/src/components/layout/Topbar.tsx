import { Bell, ChevronDown, Search, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between gap-4 px-6 lg:px-8 h-16">
        <div className="flex items-center gap-3 min-w-fit">
          <div className="size-9 rounded-2xl bg-primary-gradient grid place-items-center text-white shadow-glow">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 1.5v13M1.5 8h13"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="font-display text-xl font-bold tracking-tight">
            Symptra
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-1 mx-auto bg-secondary rounded-full p-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                  isActive
                    ? "bg-slate-900 text-white shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3 min-w-fit">
          <div className="hidden md:block w-56">
            <Input
              placeholder="Search…"
              icon={<Search className="size-4" />}
              className="bg-secondary border-transparent shadow-none"
            />
          </div>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-4" />
            <Badge
              variant="danger"
              size="sm"
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 justify-center"
            >
              3
            </Badge>
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="size-4" />
          </Button>
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <UserAvatar name={currentUser.name} size="md" />
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-semibold leading-tight">
                {currentUser.name}
              </span>
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
