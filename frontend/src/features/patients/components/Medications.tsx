import { useState } from "react";
import { CirclePause, Loader2, MoreVertical, Pencil, Play, Plus, Square, Trash2 } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MedicationDrawer } from "@/features/patients/components/MedicationDrawer";
import {
  useDeleteMedication,
  useMedications,
  useSetMedicationStatus,
} from "@/features/patients/hooks/use-medications";
import { cn } from "@/lib/utils";
import type { Medication, MedicationStatus } from "@/types";

const statusVariant: Record<MedicationStatus, "success" | "warning" | "neutral"> = {
  active: "success",
  paused: "warning",
  discontinued: "neutral",
};

export function MedicationsCard({ patientId }: { patientId: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Medication | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useMedications(patientId);
  const setStatus = useSetMedicationStatus(patientId);
  const remove = useDeleteMedication(patientId);

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (m: Medication) => {
    setEditing(m);
    setDrawerOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Medications</CardTitle>
          <Button size="sm" variant="soft" onClick={openCreate}>
            <Plus className="size-3.5" /> Add med
          </Button>
        </CardHeader>
        <CardContent className="pb-5">
          {isLoading && <MedicationsSkeleton />}

          {isError && !isLoading && (
            <ErrorBanner
              title="Couldn't load medications"
              message={error instanceof Error ? error.message : "Please try again."}
              onRetry={() => refetch()}
              retrying={isFetching}
            />
          )}

          {!isLoading && !isError && data && data.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6 rounded-xl bg-surface-subtle">
              No medications on file. Click <strong>Add med</strong> to record the first one.
            </div>
          )}

          {!isLoading && !isError && data && data.length > 0 && (
            <div className="space-y-2">
              {data.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl bg-surface-subtle p-3 transition",
                    m.status === "discontinued" && "opacity-60"
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{m.name}</span>
                      <Badge
                        variant={statusVariant[m.status]}
                        dot
                        size="sm"
                        className="capitalize"
                      >
                        {m.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {m.dose} · {m.frequency} · {m.route}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right text-xs text-muted-foreground">
                      {m.prescriber || "—"}
                      {m.startDate && (
                        <div className="text-[10px]">since {m.startDate}</div>
                      )}
                    </div>
                    <RowMenu
                      medication={m}
                      onEdit={() => openEdit(m)}
                      onSetStatus={(s) => setStatus.mutate(m.id, s)}
                      onDelete={() => setPendingDelete(m)}
                      busy={setStatus.isPending}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <MedicationDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setEditing(null);
        }}
        patientId={patientId}
        medication={editing ?? undefined}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Remove ${pendingDelete?.name}?`}
        description="This will delete the medication record. To preserve clinical history, prefer Discontinue instead."
        confirmLabel="Remove medication"
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

function RowMenu({
  medication,
  onEdit,
  onSetStatus,
  onDelete,
  busy,
}: {
  medication: Medication;
  onEdit: () => void;
  onSetStatus: (s: MedicationStatus) => void;
  onDelete: () => void;
  busy?: boolean;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Medication actions"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreVertical className="size-4" />}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-44 rounded-2xl bg-white shadow-elev border border-border p-1.5 animate-fade-in"
        >
          <MenuItem icon={<Pencil className="size-4" />} onSelect={onEdit}>
            Edit
          </MenuItem>

          {medication.status === "active" && (
            <MenuItem
              icon={<CirclePause className="size-4" />}
              onSelect={() => onSetStatus("paused")}
            >
              Pause
            </MenuItem>
          )}
          {medication.status === "paused" && (
            <MenuItem icon={<Play className="size-4" />} onSelect={() => onSetStatus("active")}>
              Resume
            </MenuItem>
          )}
          {medication.status !== "discontinued" && (
            <MenuItem
              icon={<Square className="size-4" />}
              onSelect={() => onSetStatus("discontinued")}
            >
              Discontinue
            </MenuItem>
          )}

          <DropdownMenu.Separator className="h-px bg-border my-1" />
          <MenuItem
            icon={<Trash2 className="size-4" />}
            onSelect={onDelete}
            destructive
          >
            Remove
          </MenuItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({
  icon,
  children,
  onSelect,
  destructive,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onSelect: () => void;
  destructive?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm rounded-xl cursor-pointer outline-none",
        destructive
          ? "hover:bg-danger/10 text-danger"
          : "hover:bg-secondary text-foreground"
      )}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

function MedicationsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}
