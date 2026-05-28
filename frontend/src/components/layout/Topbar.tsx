import {
  ChevronDown,
  ClipboardList,
  FileText,
  LogOut,
  Settings,
  User as UserIcon,
  Users as UsersIcon,
} from "lucide-react";
import { NotificationsBell } from "@/features/notifications/components/NotificationsBell";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { DemoBadge } from "@/features/auth/components/DemoBadge";
import { useUnreadCount } from "@/features/messages/hooks/use-unread-count";
import { useMessagesSocket } from "@/features/messages/hooks/use-messages-socket";
import { currentUser as mockUser } from "@/mocks";
import { cn } from "@/lib/utils";

type Role = "provider" | "staff" | "admin";

interface NavLeaf {
  kind: "leaf";
  to: string;
  label: string;
  /** When set, the item only renders for users whose role is in the list. */
  roles?: Role[];
  /** Hook returning a count to render as a badge next to the label. */
  useBadge?: () => number;
}

interface NavGroupChild {
  to: string;
  /** Optional search-param fragment (e.g. "?audience=patients"). When
   *  two children share the same pathname, this lets us disambiguate
   *  which one should highlight as active. */
  search?: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  kind: "group";
  label: string;
  /** Each leaf's `to` is the actual route; the group's label is the
   *  dropdown trigger. Active highlight kicks in when the current
   *  pathname starts with ANY child's `to`. */
  children: NavGroupChild[];
  roles?: Role[];
}

type NavItem = NavLeaf | NavGroup;

const navItems: NavItem[] = [
  { kind: "leaf", to: "/", label: "Dashboard" },
  { kind: "leaf", to: "/patients", label: "Patients" },
  {
    kind: "leaf",
    to: "/messages",
    label: "Communication",
    useBadge: useUnreadCount,
  },
  { kind: "leaf", to: "/appointments", label: "Appointments" },
  {
    kind: "group",
    label: "Docs",
    children: [
      {
        to: "/docs",
        label: "Documents",
        description:
          "Upload and send patient docs — labs, insurance, imaging, and more.",
        icon: FileText,
      },
      {
        to: "/forms",
        label: "Forms",
        description:
          "Consent, intake, ROI, insurance, discharge, referral workflow.",
        icon: ClipboardList,
      },
    ],
  },
  { kind: "leaf", to: "/reports", label: "Reports" },
  { kind: "leaf", to: "/users", label: "Users", roles: ["admin"] },
  // Tasks split into two queues for everyone:
  //   - My Tasks   = tasks assigned to me (scope=mine)
  //   - Tasks for Patients = patient-linked work (audience=patients)
  // Admins additionally use the URL to pivot onto the team queue when
  // they need the all-staff view, but the two visible nav options
  // match across roles.
  {
    kind: "group",
    label: "Tasks",
    children: [
      {
        to: "/tasks",
        search: "?scope=mine&audience=all",
        label: "My Tasks",
        description:
          "Tasks assigned to you — across patients and internal work.",
        icon: ClipboardList,
      },
      {
        to: "/tasks",
        search: "?audience=patients",
        label: "Tasks for Patients",
        description:
          "Patient-linked work — referrals, payments, document follow-ups.",
        icon: UsersIcon,
      },
    ],
  },
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
          {visibleNav.map((item) =>
            item.kind === "leaf" ? (
              <NavItemLink key={item.to} item={item} />
            ) : (
              <NavItemGroup key={item.label} item={item} />
            )
          )}
        </nav>

        <div className="flex items-center gap-2 min-w-fit">
          <DemoBadge />

          <NotificationsBell />

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

function NavItemLink({ item }: { item: NavLeaf }) {
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

function NavItemGroup({ item }: { item: NavGroup }) {
  const location = useLocation();
  const { pathname, search } = location;
  const navigate = useNavigate();

  // True when the URL matches a child's pathname AND (if the child
  // has a `search` discriminator) the relevant search param matches.
  const childMatches = (c: NavGroupChild): boolean => {
    const pathMatches = pathname === c.to || pathname.startsWith(`${c.to}/`);
    if (!pathMatches) return false;
    if (!c.search) return true;
    // Compare just the keys in the child's search fragment so other
    // unrelated params (e.g., ?page=2) don't break the match.
    const childParams = new URLSearchParams(c.search);
    const liveParams = new URLSearchParams(search);
    for (const [key, value] of childParams) {
      if (liveParams.get(key) !== value) return false;
    }
    return true;
  };

  // The group trigger highlights when any child matches.
  const isActive = item.children.some(childMatches);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "px-4 xl:px-5 py-2 rounded-full text-[14px] font-medium transition-all inline-flex items-center gap-1.5 ring-focus",
            isActive
              ? "bg-slate-900 text-white shadow-soft"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          )}
        >
          {item.label}
          <ChevronDown
            className={cn(
              "size-3.5 transition",
              isActive ? "text-white/80" : "text-muted-foreground"
            )}
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          align="start"
          className="z-50 w-72 rounded-2xl bg-white shadow-elev border border-border p-1.5 animate-fade-in"
        >
          {item.children.map((child) => {
            const Icon = child.icon;
            const childActive = childMatches(child);
            return (
              <DropdownMenu.Item
                key={`${child.to}${child.search ?? ""}`}
                onSelect={() =>
                  navigate({
                    pathname: child.to,
                    search: child.search ?? "",
                  })
                }
                className={cn(
                  "flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer outline-none",
                  childActive ? "bg-primary/10" : "hover:bg-secondary"
                )}
              >
                <div
                  className={cn(
                    "size-9 rounded-xl grid place-items-center shrink-0 [&_svg]:size-4",
                    childActive
                      ? "bg-primary/15 text-primary"
                      : "bg-surface-subtle text-muted-foreground"
                  )}
                >
                  <Icon />
                </div>
                <div className="min-w-0">
                  <div
                    className={cn(
                      "text-sm font-semibold",
                      childActive && "text-primary"
                    )}
                  >
                    {child.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    {child.description}
                  </div>
                </div>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
