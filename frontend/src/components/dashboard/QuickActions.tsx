import {
  CalendarPlus,
  ClipboardList,
  FilePlus,
  PhoneCall,
  Stethoscope,
  UserPlus2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const actions = [
  { label: "New patient", icon: UserPlus2, accent: "bg-primary/10 text-primary" },
  { label: "Schedule visit", icon: CalendarPlus, accent: "bg-emerald-100 text-emerald-700" },
  { label: "Open SOAP", icon: ClipboardList, accent: "bg-violet-100 text-violet-700" },
  { label: "Order labs", icon: Stethoscope, accent: "bg-amber-100 text-amber-700" },
  { label: "Upload doc", icon: FilePlus, accent: "bg-rose-100 text-rose-700" },
  { label: "Call team", icon: PhoneCall, accent: "bg-sky-100 text-sky-700" },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-2 pb-5">
        {actions.map(({ label, icon: Icon, accent }) => (
          <button
            key={label}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface-subtle border border-border/60 hover:border-primary/30 hover:-translate-y-0.5 transition text-center"
          >
            <div className={cn("size-9 rounded-xl grid place-items-center", accent)}>
              <Icon className="size-4" />
            </div>
            <span className="text-xs font-medium leading-tight">{label}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
