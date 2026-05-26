import { CalendarDays, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";
import { SurgeryRing } from "@/components/dashboard/SurgeryRing";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { TeamGantt } from "@/components/dashboard/TeamGantt";
import { TeamAvailability } from "@/components/dashboard/TeamAvailability";
import { AiRecommendations } from "@/components/dashboard/AiRecommendations";
import { UpcomingAppointments } from "@/components/dashboard/UpcomingAppointments";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { StatCard } from "@/components/ui/stat-card";
import {
  BubbleCluster,
  GaugeMeter,
  Sparkline,
  StackedBars,
} from "@/components/dashboard/MiniCharts";
import { alerts, todayKpis } from "@/data/mock";
import { Activity, CalendarCheck2, HeartPulse, Users } from "lucide-react";

export function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Welcome back, Dr. Robert! ☀️"
        subtitle="Endoprosthetics department · April 03, 2025"
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              placeholder="Search…"
              icon={<Search className="size-4" />}
              className="w-56"
            />
            <Button variant="secondary">
              <CalendarDays className="size-4" /> Monthly
            </Button>
            <Button variant="secondary">
              <Download className="size-4" /> Export data
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5 mb-6">
        <StatCard
          label="Top treatment"
          value="580"
          delta={{ value: 24, positive: true }}
          icon={<Activity />}
          accent="primary"
          hint="View more"
        >
          <BubbleCluster />
          <div className="flex items-center gap-x-3 gap-y-1 text-[11px] flex-wrap mt-3">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Surgery
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
              Consultation
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/40" />
              Diagnosis
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/20" />
              Biopsy
            </span>
          </div>
        </StatCard>

        <StatCard
          label="Satisfaction rate"
          value="85%"
          delta={{ value: 2, positive: false }}
          icon={<HeartPulse />}
          accent="success"
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
          <StackedBars />
          <div className="flex items-center gap-x-3 gap-y-1 text-[11px] flex-wrap mt-3">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Inpatient
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
              Discharged
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/40" />
              Outpatient
            </span>
          </div>
        </StatCard>

        <StatCard
          label="Total appointments"
          value="260"
          delta={{ value: 16, positive: true }}
          icon={<CalendarCheck2 />}
          accent="warning"
          hint="View more"
        >
          <Sparkline />
        </StatCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 mb-6">
        <div className="lg:col-span-4">
          <SurgeryRing
            title="Surgeries scheduled on the day"
            total={todayKpis.totalToday}
            finished={todayKpis.finished}
            upcoming={todayKpis.upcoming}
            delta={2}
            label="Total interventions"
          />
        </div>
        <div className="lg:col-span-4">
          <SurgeryRing
            title="At-Risk interventions on the day"
            total={todayKpis.atRiskTotal}
            finished={todayKpis.atRiskFinished}
            upcoming={todayKpis.atRiskUpcoming}
            label="Total at-risk interventions"
            variant="warning"
          />
        </div>
        <div className="lg:col-span-4">
          <AlertCard alerts={alerts} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 mb-6">
        <div className="lg:col-span-8">
          <TeamGantt />
        </div>
        <div className="lg:col-span-4">
          <TeamAvailability />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 mb-6">
        <div className="lg:col-span-8">
          <UpcomingAppointments />
        </div>
        <div className="lg:col-span-4 space-y-4 lg:space-y-5">
          <AiRecommendations />
          <QuickActions />
        </div>
      </div>
    </>
  );
}
