import { ChevronsUpDown, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { Patient } from "@/types";

const ROW_BG = "#F5F7FB";

export function PatientTable({ data }: { data: Patient[] }) {
  return (
    <Card className="overflow-hidden p-3 sm:p-4">
      <div className="overflow-x-auto">
        <table
          className="w-full text-sm border-separate"
          style={{ borderSpacing: "0 8px" }}
        >
          <thead>
            <tr className="text-xs text-muted-foreground text-left">
              <th
                className="font-medium px-4 py-3 w-10 first:rounded-l-full"
                style={{ background: ROW_BG }}
              >
                <input type="checkbox" className="rounded border-border" />
              </th>
              <Th>Patient ID</Th>
              <Th>Patient name</Th>
              <Th>Procedure</Th>
              <Th>Status</Th>
              <Th>Procedure date</Th>
              <Th>Assigned physician</Th>
              <Th>Tags</Th>
              <th
                className="font-medium px-4 py-3 text-right last:rounded-r-full"
                style={{ background: ROW_BG }}
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr
                key={p.id}
                className="hover:[&_td]:bg-[#EEF2F8] transition group"
              >
                <td
                  className="px-4 py-3.5 first:rounded-l-full"
                  style={{ background: ROW_BG }}
                >
                  <input type="checkbox" className="rounded border-border" />
                </td>
                <td
                  className="px-4 py-3.5 text-primary font-semibold"
                  style={{ background: ROW_BG }}
                >
                  <Link to={`/patients/${p.id}`} className="hover:underline">
                    {p.mrn}
                  </Link>
                </td>
                <td className="px-4 py-3.5" style={{ background: ROW_BG }}>
                  <div className="flex items-center gap-2.5">
                    <UserAvatar name={p.name} src={p.avatarUrl} size="md" />
                    <Link
                      to={`/patients/${p.id}`}
                      className="font-semibold hover:text-primary transition"
                    >
                      {p.name}
                    </Link>
                  </div>
                </td>
                <td
                  className="px-4 py-3.5 text-foreground/80"
                  style={{ background: ROW_BG }}
                >
                  {p.procedure}
                </td>
                <td className="px-4 py-3.5" style={{ background: ROW_BG }}>
                  <StatusPill status={p.status} />
                </td>
                <td
                  className="px-4 py-3.5 text-foreground/80"
                  style={{ background: ROW_BG }}
                >
                  {formatDate(p.procedureDate)}
                </td>
                <td className="px-4 py-3.5" style={{ background: ROW_BG }}>
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      name={p.assignedPhysician.name}
                      size="md"
                    />
                    <span className="text-foreground">
                      {p.assignedPhysician.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3.5" style={{ background: ROW_BG }}>
                  <div className="flex gap-1 flex-wrap">
                    {p.tags.map((t) => (
                      <Badge
                        key={t}
                        variant="neutral"
                        size="sm"
                        className="font-normal bg-white text-foreground/70"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td
                  className="px-4 py-3.5 last:rounded-r-full"
                  style={{ background: ROW_BG }}
                >
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full bg-white hover:bg-white/80 text-foreground/70"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full bg-white hover:bg-rose-50 text-danger"
                    >
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
    <th className="font-medium px-4 py-3" style={{ background: ROW_BG }}>
      <button className="inline-flex items-center gap-1 hover:text-foreground transition">
        {children}
        <ChevronsUpDown className="size-3 opacity-60" />
      </button>
    </th>
  );
}
