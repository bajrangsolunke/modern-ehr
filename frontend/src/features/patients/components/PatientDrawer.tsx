import { Drawer } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Card } from "@/components/ui/card";
import { PatientForm } from "@/features/patients/components/PatientForm";
import { useCreatePatient } from "@/features/patients/hooks/use-create-patient";
import { useUpdatePatient } from "@/features/patients/hooks/use-update-patient";
import { usePatient } from "@/features/patients/hooks/use-patient";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the drawer edits an existing patient. Omit for a create flow. */
  patientId?: string;
}

/**
 * Unified create + edit drawer.
 * - No `patientId` → "New patient" flow, calls useCreatePatient.
 * - `patientId` set → "Edit patient" flow, fetches the patient and
 *   calls useUpdatePatient(id).
 *
 * On success in either flow we close the drawer; the patients list /
 * profile page refetches itself via React Query cache invalidation
 * inside the mutation hooks.
 */
export function PatientDrawer({ open, onOpenChange, patientId }: Props) {
  const isEdit = Boolean(patientId);
  const create = useCreatePatient();
  const update = useUpdatePatient(patientId);
  const { data: patient, isLoading, isError, error, refetch, isFetching } =
    usePatient(isEdit ? patientId : undefined);

  const submitting = isEdit ? update.isPending : create.isPending;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit patient" : "New patient"}
      description={
        isEdit
          ? patient
            ? `MRN ${patient.mrn} · ${patient.name}`
            : "Loading…"
          : "Onboarding flow · all required fields marked *"
      }
      size="xl"
    >
      {isEdit && isLoading && <DrawerFormSkeleton />}
      {isEdit && isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load patient"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}
      {(!isEdit || (isEdit && !isLoading && !isError && patient)) && (
        <PatientForm
          defaultPatient={isEdit ? patient : undefined}
          submitting={submitting}
          submitLabel={isEdit ? "Save changes" : "Create patient"}
          onCancel={() => onOpenChange(false)}
          onSubmit={async (input) => {
            if (isEdit) {
              await update.mutateAsync(input);
            } else {
              await create.mutateAsync(input);
            }
            onOpenChange(false);
          }}
        />
      )}
    </Drawer>
  );
}

function DrawerFormSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, s) => (
        <Card key={s} className="p-5 space-y-3">
          <Skeleton className="h-5 w-28 rounded-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-10 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
