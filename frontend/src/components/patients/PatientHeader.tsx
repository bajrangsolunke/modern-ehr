import { CalendarClock, MoreHorizontal, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import type { Patient } from "@/types";
import { Badge } from "@/components/ui/badge";

export function PatientHeader({ patient }: { patient: Patient }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <UserAvatar name={patient.name} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold">{patient.name}</h2>
              <Badge variant="default" size="sm">ID {patient.mrn}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {patient.sex} · {patient.dob} · {patient.city ?? "—"}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm">
                <Phone className="size-3.5" /> Call
              </Button>
              <Button size="sm" variant="secondary">
                <CalendarClock className="size-3.5" /> Schedule visit
              </Button>
              <Button size="icon" variant="ghost" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2 text-sm">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Planned procedure details
          </h4>
          <KV k="Planned procedure" v={patient.procedure} />
          <KV k="Surgery date" v={patient.procedureDate} />
          <KV k="Attending physician" v={patient.assignedPhysician.name} />
          <KV k="Anesthesiologist" v="Dr. med. Weber" />
          <KV
            k="Status"
            v={
              <Badge variant="warning" dot size="sm">
                Awaiting final clearance
              </Badge>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{k}:</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}
