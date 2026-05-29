import { useNavigate } from "react-router-dom";
import { Ruler, Scale, User, UserCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { DashboardProfile, DashboardGreeting } from "../api/dashboard-api";

interface Props {
  profile: DashboardProfile;
  greeting: DashboardGreeting;
}

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}

function StatItem({ icon, label, value }: StatItemProps) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/50">
      <div className="size-7 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold leading-none">
          {label}
        </div>
        <div className="text-sm font-semibold mt-0.5 truncate">
          {value ?? "—"}
        </div>
      </div>
    </div>
  );
}

export function ProfileCard({ profile, greeting }: Props) {
  const navigate = useNavigate();
  const fullName = greeting.first_name;

  const heightStr = profile.height_cm
    ? `${profile.height_cm} cm`
    : null;
  const weightStr = profile.weight_kg
    ? `${profile.weight_kg} kg`
    : null;
  const ageStr = profile.age != null ? `${profile.age} yrs` : null;

  return (
    <Card className="p-5 flex flex-col items-center gap-4">
      {/* Avatar */}
      <UserAvatar
        name={fullName}
        src={profile.avatar_url ?? undefined}
        size="xl"
        variant="gradient"
      />

      {/* Name */}
      <div className="text-center">
        <div className="text-base font-bold leading-tight">{fullName}</div>
        {profile.gender && (
          <div className="text-xs text-muted-foreground mt-0.5">{profile.gender}</div>
        )}
      </div>

      {/* Stats 2-up grid */}
      <div className="w-full grid grid-cols-2 gap-2">
        <StatItem
          icon={<UserCircle2 className="size-3.5" />}
          label="Gender"
          value={profile.gender}
        />
        <StatItem
          icon={<User className="size-3.5" />}
          label="Age"
          value={ageStr}
        />
        <StatItem
          icon={<Ruler className="size-3.5" />}
          label="Height"
          value={heightStr}
        />
        <StatItem
          icon={<Scale className="size-3.5" />}
          label="Weight"
          value={weightStr}
        />
      </div>

      <Button
        size="sm"
        variant="secondary"
        className="w-full"
        onClick={() => navigate("/settings")}
      >
        Show All Information
      </Button>
    </Card>
  );
}
