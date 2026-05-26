import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormSkeleton } from "@/features/patients/components/ProfileSkeleton";
import { PatientForm } from "@/features/patients/components/PatientForm";
import { usePatient } from "@/features/patients/hooks/use-patient";
import { useUpdatePatient } from "@/features/patients/hooks/use-update-patient";

export function PatientEditPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { data: patient, isLoading, isError, error, refetch, isFetching } =
    usePatient(patientId);
  const update = useUpdatePatient(patientId);

  return (
    <>
      <PageHeader
        title="Edit patient"
        back
        onBack={() => navigate(-1)}
        right={
          patient && (
            <span className="text-xs text-muted-foreground">MRN {patient.mrn}</span>
          )
        }
      />

      {isLoading && <FormSkeleton />}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load patient"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && patient && (
        <div className="max-w-5xl">
          <PatientForm
            defaultPatient={patient}
            submitting={update.isPending}
            submitLabel="Save changes"
            onCancel={() => navigate(`/patients/${patient.id}`)}
            onSubmit={async (input) => {
              await update.mutateAsync(input);
              navigate(`/patients/${patient.id}`, { replace: true });
            }}
          />
        </div>
      )}
    </>
  );
}
