import { ChevronsUpDown, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { Patient } from "@/types";

export function PatientTable({ data }: { data: Patient[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle">
            <tr className="text-xs text-muted-foreground text-left">
              <th className="font-medium px-4 py-3 w-10">
                <input type="checkbox" className="rounded border-border" />
              </th>
              <Th>Patient ID</Th>
              <Th>Patient name</Th>
              <Th>Procedure</Th>
              <Th>Status</Th>
              <Th>Procedure date</Th>
              <Th>Assigned physician</Th>
              <Th>Tags</Th>
              <th className="font-medium px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {data.map((p) => (
              <tr key={p.id} className="hover:bg-surface-subtle/70 transition">
                <td className="px-4 py-3">
                  <input type="checkbox" className="rounded border-border" />
                </td>
                <td className="px-4 py-3 text-primary font-semibold">
                  <Link to={`/patients/${p.id}`}>{p.mrn}</Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar name={p.name} src={p.avatarUrl} size="sm" />
                    <Link
                      to={`/patients/${p.id}`}
                      className="font-medium hover:text-primary transition"
                    >
                      {p.name}
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.procedure}</td>
                <td className="px-4 py-3">
                  <StatusPill status={p.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(p.procedureDate)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={p.assignedPhysician.name} size="sm" />
                    <span className="text-foreground">{p.assignedPhysician.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {p.tags.map((t) => (
                      <Badge key={t} variant="neutral" size="sm" className="font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="size-8">
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-danger">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="font-medium px-4 py-3">
      <button className="inline-flex items-center gap-1 hover:text-foreground transition">
        {children}
        <ChevronsUpDown className="size-3" />
      </button>
    </th>
  );
}
