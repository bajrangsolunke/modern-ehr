import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { PatientForm } from "@/features/patients/components/PatientForm";
import { useCreatePatient } from "@/features/patients/hooks/use-create-patient";

export function PatientNewPage() {
  const navigate = useNavigate();
  const create = useCreatePatient();

  return (
    <>
      <PageHeader
        title="New patient"
        back
        onBack={() => navigate(-1)}
        right={
          <span className="text-xs text-muted-foreground">
            Onboarding flow
          </span>
        }
      />
      <div className="max-w-5xl">
        <PatientForm
          submitting={create.isPending}
          submitLabel="Create patient"
          onCancel={() => navigate(-1)}
          onSubmit={async (input) => {
            const created = await create.mutateAsync(input);
            navigate(`/patients/${created.id}`, { replace: true });
          }}
        />
      </div>
    </>
  );
}
