/**
 * Reports section — US-RPT-1
 * (docs/superpowers/specs/2026-05-27-workflow-user-stories.md).
 *
 * Parent route with a left sidebar. Today the only entry is Insights
 * (formerly the top-level /insights page); future report pages plug in
 * with one more sidebar entry + nested route.
 */
import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, LineChart, CreditCard, CalendarCheck, Users, Stethoscope, Gauge } from "lucide-react";
import { ROUTES } from "@/config/constants";
import { cn } from "@/lib/utils";

interface ReportLink {
  to: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const REPORTS: ReportLink[] = [
  {
    to: ROUTES.reportsInsights,
    label: "Insights",
    description: "Live clinic snapshot",
    icon: LineChart,
  },
  {
    to: ROUTES.reportsPayments,
    label: "Payments",
    description: "Collections, refunds, A/R aging",
    icon: CreditCard,
  },
  {
    to: ROUTES.reportsAppointments,
    label: "Appointments",
    description: "Volume, status, no-show rate",
    icon: CalendarCheck,
  },
  {
    to: ROUTES.reportsPatientVolume,
    label: "Patient Volume",
    description: "New vs returning, demographics",
    icon: Users,
  },
  {
    to: ROUTES.reportsClinical,
    label: "Clinical",
    description: "Top diagnoses, encounter volume",
    icon: Stethoscope,
  },
  {
    to: ROUTES.reportsProductivity,
    label: "Productivity",
    description: "Per-provider performance",
    icon: Gauge,
  },
];

export function ReportsLayout() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
      <aside className="lg:sticky lg:top-[100px] self-start">
        <nav className="rounded-2xl bg-white border border-border shadow-soft p-2">
          <div className="px-3 py-2 border-b border-border mb-1.5 flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            <h2 className="text-sm font-bold">Reports</h2>
          </div>
          <ul className="space-y-1">
            {REPORTS.map((r) => {
              const Icon = r.icon;
              return (
                <li key={r.to}>
                  <NavLink
                    to={r.to}
                    className={({ isActive }) =>
                      cn(
                        "block rounded-xl px-3 py-2.5 transition ring-focus",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-surface-subtle text-foreground"
                      )
                    }
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="size-4" />
                      <span className="text-sm font-semibold">{r.label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 pl-6">
                      {r.description}
                    </p>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
