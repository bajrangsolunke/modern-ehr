import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { UserAvatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PatientDrawer } from "@/features/patients/components/PatientDrawer";
import { useDeletePatient } from "@/features/patients/hooks/use-delete-patient";
import { formatDate } from "@/lib/utils";
import type { Patient } from "@/types";

export function PatientCardGrid({ data }: { data: Patient[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Patient | null>(null);
  const remove = useDeletePatient();

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.025 }}
          >
            <Card className="card-hover">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <input
                    type="checkbox"
                    className="rounded border-border mt-1"
                    aria-label={`Select ${p.name}`}
                  />
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-full"
                      aria-label="Edit patient"
                      onClick={() => setEditingId(p.id)}
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-full text-danger hover:bg-rose-50"
                      aria-label="Remove patient"
                      onClick={() => setPendingDelete(p)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <UserAvatar name={p.name} src={p.avatarUrl} size="lg" />
                  <div className="min-w-0">
                    <Link
                      to={`/patients/${p.id}`}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      ID: {p.mrn}
                    </Link>
                    <h3 className="font-semibold truncate text-sm">{p.name}</h3>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <Row label="Procedure" value={p.procedure} />
                  <Row label="Status" value={<StatusPill status={p.status} />} />
                  <Row label="Procedure date" value={formatDate(p.procedureDate)} />
                  <Row
                    label="Assigned provider"
                    value={
                      <div className="flex items-center gap-1.5">
                        <UserAvatar name={p.assignedPhysician.name} size="xs" />
                        <span className="truncate">{p.assignedPhysician.name}</span>
                      </div>
                    }
                  />
                  <div>
                    <span className="text-muted-foreground">Tags:</span>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {p.tags.map((t) => (
                        <Badge
                          key={t}
                          variant="neutral"
                          size="sm"
                          className="font-normal"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

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

      <PatientDrawer
        open={Boolean(editingId)}
        onOpenChange={(open) => !open && setEditingId(null)}
        patientId={editingId ?? undefined}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground font-medium text-right truncate">{value}</span>
    </div>
  );
}
