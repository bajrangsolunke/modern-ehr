import { Drawer } from "@/components/ui/drawer";
import { PatientForm } from "@/features/patients/components/PatientForm";
import { useCreatePatient } from "@/features/patients/hooks/use-create-patient";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * On successful create, close the drawer and stay on the listing page.
 * The list refetches itself via the QUERY_KEYS.patients.all invalidate
 * inside useCreatePatient, so the new record appears in place.
 */
export function PatientNewDrawer({ open, onOpenChange }: Props) {
  const create = useCreatePatient();

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="New patient"
      description="Onboarding flow · all required fields marked *"
      size="xl"
    >
      <PatientForm
        submitting={create.isPending}
        submitLabel="Create patient"
        onCancel={() => onOpenChange(false)}
        onSubmit={async (input) => {
          await create.mutateAsync(input);
          onOpenChange(false);
        }}
      />
    </Drawer>
  );
}
