import {
  Activity,
  CalendarCheck2,
  CalendarDays,
  Download,
  HeartPulse,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/stat-card";
import {
  BubbleCluster,
  GaugeMeter,
  Sparkline,
  StackedBars,
} from "@/features/dashboard/components/MiniCharts";
import { UpcomingAppointments } from "@/features/dashboard/components/UpcomingAppointments";
import { RequestedTasks } from "@/features/dashboard/components/RequestedTasks";
import { MessagesNotificationCard } from "@/features/dashboard/components/MessagesNotificationCard";
import { useAuthStore } from "@/stores/auth-store";

function useGreetingName() {
  const user = useAuthStore((s) => s.user);
  if (!user) return "Doctor";
  const first = user.name.replace(/^Dr\.\s*/, "").split(" ")[0];
  return `Dr. ${first}`;
}

export function DashboardPage() {
  const greetingName = useGreetingName();
  return (
    <>
      <PageHeader
        title={`Welcome back, ${greetingName}! ☀️`}
        right={
          <>
            <Input
              placeholder="Search…"
              icon={<Search className="size-4" />}
              className="w-48 lg:w-56 h-10"
            />
            <Button variant="secondary" className="h-10">
              <CalendarDays className="size-4" /> Monthly
            </Button>
            <Button variant="secondary" className="h-10">
              <Download className="size-4" /> Export data
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5 mb-5 lg:mb-6">
        <StatCard
          label="Top treatment"
          value="580"
          delta={{ value: 24, positive: true }}
          icon={<Activity />}
          accent="primary"
          hint="View more"
        >
          <div className="flex items-center gap-x-3 gap-y-1 text-[12px] font-medium flex-wrap mb-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Surgery
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary/60" />
              Consultation
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary/40" />
              Diagnosis
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary/20" />
              Biopsy
            </span>
          </div>
          <BubbleCluster />
        </StatCard>

        <StatCard
          label="Satisfaction rate"
          value="85%"
          delta={{ value: 2, positive: false }}
          icon={<HeartPulse />}
          accent="primary"
          hint="View more"
        >
          <GaugeMeter value={85} />
        </StatCard>

        <StatCard
          label="Total patients"
          value="620"
          delta={{ value: 28, positive: true }}
          icon={<Users />}
          accent="primary"
          hint="View more"
        >
          <div className="flex items-center gap-x-3 gap-y-1 text-[12px] font-medium flex-wrap mb-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Inpatient
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary/60" />
              Discharged
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary/40" />
              Outpatient
            </span>
          </div>
          <StackedBars />
        </StatCard>

        <StatCard
          label="Total appointment"
          value="260"
          delta={{ value: 16, positive: true }}
          icon={<CalendarCheck2 />}
          accent="primary"
          hint="View more"
        >
          <Sparkline />
        </StatCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-5">
        <div className="xl:col-span-2">
          <UpcomingAppointments />
        </div>
        <div className="xl:col-span-1 space-y-4 lg:space-y-5">
          <RequestedTasks />
          <MessagesNotificationCard />
        </div>
      </div>
    </>
  );
}
