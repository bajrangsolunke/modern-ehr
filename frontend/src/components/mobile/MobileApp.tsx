import {
  Activity,
  Bell,
  Cigarette,
  Heart,
  Home,
  Menu,
  MessageCircle,
  Pill,
  Smile,
  User,
  Wine,
} from "lucide-react";
import { motion } from "framer-motion";
import { UserAvatar } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const requests = [
  { id: "r1", name: "Dr. Esther Howard", specialty: "Orthopedic oncologist", date: "02 Apr. 10:00" },
  { id: "r2", name: "Dr. Albert Flores", specialty: "Radiologist", date: "04 Apr. 09:00" },
  { id: "r3", name: "Dr. Cameron Williamson", specialty: "Infectious disease specialist", date: "04 Apr. 14:00" },
];

export function MobileApp() {
  return (
    <div className="px-4 pt-10 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <UserAvatar name="Gwen Stecy" size="md" />
          <div>
            <div className="text-[10px] text-muted-foreground leading-none">
              Good Morning
            </div>
            <div className="text-sm font-bold leading-tight">Gwen Stecy</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="secondary" className="size-9 bg-white">
            <Bell className="size-4" />
          </Button>
          <Button size="icon" variant="secondary" className="size-9 bg-white">
            <Menu className="size-4" />
          </Button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="relative overflow-hidden bg-primary-gradient text-white border-transparent">
          <CardContent className="p-4">
            <h3 className="font-bold text-base leading-tight">
              Update Medical Data!
            </h3>
            <p className="text-xs opacity-90 mt-1 leading-snug">
              Keep your records up to date. Fill out the forms accurately.
            </p>
            <Button
              size="sm"
              className="mt-3 bg-white text-primary hover:bg-white/90 shadow-none"
            >
              Go to my data
            </Button>
            <div className="absolute right-0 top-0 bottom-0 w-24 bg-white/10 rounded-l-full" />
            <div className="absolute right-2 bottom-2 size-16 rounded-full bg-white/20 grid place-items-center text-2xl">
              👨‍⚕️
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Services</h3>
        <button className="text-xs text-primary">View all ›</button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-primary/10 grid place-items-center text-primary">
                <Activity className="size-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Lifestyle Monitor</div>
                <div className="text-[10px] text-muted-foreground">Not updated</div>
              </div>
            </div>
            <Badge variant="default" size="sm">25%</Badge>
          </div>

          <div className="mt-4 text-xs text-muted-foreground leading-snug">
            You can achieve your goal by updating the
            <br />
            following information
          </div>

          <svg viewBox="0 0 200 60" className="mt-3 w-full">
            <path
              d="M 0 40 Q 30 20, 60 35 T 120 30 T 180 25"
              stroke="#4F8CFF"
              strokeWidth="2.5"
              fill="none"
            />
            <circle cx="120" cy="30" r="4" fill="#4F8CFF" />
            <circle cx="120" cy="30" r="9" fill="#4F8CFF" opacity="0.2" />
          </svg>

          <div className="grid grid-cols-4 gap-2 mt-3">
            <Lifestyle icon={<Cigarette className="size-3.5" />} label="Smoking" />
            <Lifestyle icon={<Activity className="size-3.5" />} label="Activity" />
            <Lifestyle icon={<Wine className="size-3.5" />} label="Alcohol" />
            <Lifestyle icon={<Smile className="size-3.5" />} label="Mood" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Vitals · Today</h3>
            <Badge variant="success" size="sm" dot>Normal</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Vital icon="❤️" label="HR" value="72" unit="bpm" />
            <Vital icon="🩸" label="BP" value="118/76" />
            <Vital icon="🫁" label="SpO₂" value="98" unit="%" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Medications today</h3>
            <Badge variant="warning" size="sm">3 due</Badge>
          </div>
          <div className="space-y-2">
            {[
              { name: "Apixaban", time: "8:00 AM", taken: true },
              { name: "Metformin", time: "12:00 PM", taken: false },
              { name: "Atorvastatin", time: "9:00 PM", taken: false },
            ].map((m) => (
              <div
                key={m.name}
                className="flex items-center justify-between rounded-xl bg-surface-subtle px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary grid place-items-center">
                    <Pill className="size-3.5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{m.name}</div>
                    <div className="text-[10px] text-muted-foreground">{m.time}</div>
                  </div>
                </div>
                {m.taken ? (
                  <Badge variant="success" size="sm" dot>
                    Taken
                  </Badge>
                ) : (
                  <Button size="xs">Take</Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Step goal</h3>
            <span className="text-xs text-muted-foreground">5,103 / 8,000</span>
          </div>
          <Progress value={64} />
        </CardContent>
      </Card>

      <div>
        <h3 className="font-semibold text-sm mb-2">Appointment requests</h3>
        <div className="space-y-2">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <UserAvatar name={r.name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{r.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {r.specialty}
                  </div>
                </div>
                <Badge variant="default" size="sm">{r.date}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-border">
        <div className="flex items-center justify-around py-3">
          {[
            { icon: Home, active: true },
            { icon: MessageCircle, active: false },
            { icon: Heart, active: false },
            { icon: User, active: false },
          ].map((t, i) => (
            <button
              key={i}
              className={`size-10 rounded-full grid place-items-center transition ${
                t.active
                  ? "bg-primary-gradient text-white shadow-glow"
                  : "text-muted-foreground"
              }`}
            >
              <t.icon className="size-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Lifestyle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-surface-subtle p-2 text-center">
      <div className="text-primary">{icon}</div>
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  );
}

function Vital({
  icon,
  label,
  value,
  unit,
}: {
  icon: string;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-xl bg-surface-subtle p-3 text-center">
      <div className="text-lg">{icon}</div>
      <div className="text-sm font-bold leading-none mt-1">
        {value}
        {unit && <span className="text-[10px] text-muted-foreground ml-0.5">{unit}</span>}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
