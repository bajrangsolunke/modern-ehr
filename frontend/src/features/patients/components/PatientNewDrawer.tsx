import { useNavigate } from "react-router-dom";
import { Drawer } from "@/components/ui/drawer";
import { PatientForm } from "@/features/patients/components/PatientForm";
import { useCreatePatient } from "@/features/patients/hooks/use-create-patient";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where to go after a successful create. Defaults to the new patient's profile. */
  onCreated?: (id: string) => void;
}

export function PatientNewDrawer({ open, onOpenChange, onCreated }: Props) {
  const navigate = useNavigate();
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
          const created = await create.mutateAsync(input);
          onOpenChange(false);
          if (onCreated) onCreated(created.id);
          else navigate(`/patients/${created.id}`);
        }}
      />
    </Drawer>
  );
}
