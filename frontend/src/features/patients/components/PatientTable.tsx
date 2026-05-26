import { useState } from "react";
import { ChevronsUpDown, Pencil, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDeletePatient } from "@/features/patients/hooks/use-delete-patient";
import { formatDate } from "@/lib/utils";
import type { Patient } from "@/types";

const ROW_BG = "#F5F7FB";
const HEADER_BG = "#FFFFFF";
const HEADER_SHADOW = "0 4px 12px rgba(17,24,39,0.06)";

export function PatientTable({ data }: { data: Patient[] }) {
  const navigate = useNavigate();
  const remove = useDeletePatient();
  const [pendingDelete, setPendingDelete] = useState<Patient | null>(null);

  return (
    <>
      <Card className="overflow-hidden p-3 sm:p-4">
        <div className="overflow-x-auto">
          <table
            className="w-full text-sm border-separate"
            style={{ borderSpacing: "0 6px" }}
          >
            <thead>
              <tr className="text-xs text-muted-foreground text-left">
                <th
                  className="font-medium px-4 py-2 w-10 first:rounded-l-full"
                  style={{ background: HEADER_BG, boxShadow: HEADER_SHADOW }}
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
                  className="font-medium px-4 py-2 text-right last:rounded-r-full"
                  style={{ background: HEADER_BG, boxShadow: HEADER_SHADOW }}
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
                    className="px-4 py-2 first:rounded-l-full"
                    style={{ background: ROW_BG }}
                  >
                    <input type="checkbox" className="rounded border-border" />
                  </td>
                  <td
                    className="px-4 py-2 text-primary font-semibold"
                    style={{ background: ROW_BG }}
                  >
                    <Link to={`/patients/${p.id}`} className="hover:underline">
                      {p.mrn}
                    </Link>
                  </td>
                  <td className="px-4 py-2" style={{ background: ROW_BG }}>
                    <div className="flex items-center gap-2">
                      <UserAvatar name={p.name} src={p.avatarUrl} size="sm" />
                      <Link
                        to={`/patients/${p.id}`}
                        className="font-semibold hover:text-primary transition"
                      >
                        {p.name}
                      </Link>
                    </div>
                  </td>
                  <td
                    className="px-4 py-2 text-foreground/80"
                    style={{ background: ROW_BG }}
                  >
                    {p.procedure}
                  </td>
                  <td className="px-4 py-2" style={{ background: ROW_BG }}>
                    <StatusPill status={p.status} />
                  </td>
                  <td
                    className="px-4 py-2 text-foreground/80"
                    style={{ background: ROW_BG }}
                  >
                    {formatDate(p.procedureDate)}
                  </td>
                  <td className="px-4 py-2" style={{ background: ROW_BG }}>
                    <div className="flex items-center gap-2">
                      <UserAvatar name={p.assignedPhysician.name} size="sm" />
                      <span className="text-foreground">{p.assignedPhysician.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2" style={{ background: ROW_BG }}>
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
                    className="px-4 py-2 last:rounded-r-full"
                    style={{ background: ROW_BG }}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-full bg-white hover:bg-white/80 text-foreground/70"
                        aria-label="Edit patient"
                        onClick={() => navigate(`/patients/${p.id}/edit`)}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-full bg-white hover:bg-rose-50 text-danger"
                        aria-label="Delete patient"
                        onClick={() => setPendingDelete(p)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Remove ${pendingDelete?.name}?`}
        description="This will remove the patient record. This action can't be undone."
        confirmLabel="Remove patient"
        destructive
        busy={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await remove.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="font-medium px-4 py-2"
      style={{ background: HEADER_BG, boxShadow: HEADER_SHADOW }}
    >
      <button className="inline-flex items-center gap-1 hover:text-foreground transition">
        {children}
        <ChevronsUpDown className="size-3 opacity-60" />
      </button>
    </th>
  );
}
