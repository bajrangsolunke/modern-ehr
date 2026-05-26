import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PatientDrawer } from "@/features/patients/components/PatientDrawer";
import { ProfileSkeleton } from "@/features/patients/components/ProfileSkeleton";
import { useDeletePatient } from "@/features/patients/hooks/use-delete-patient";
import { PatientHeader } from "@/features/patients/components/PatientHeader";
import { KeyClinicalOverview } from "@/features/patients/components/KeyClinicalOverview";
import { KeyDocuments } from "@/features/patients/components/KeyDocuments";
import { ImportantAlerts } from "@/features/patients/components/ImportantAlerts";
import { ChecklistCard } from "@/features/patients/components/Checklist";
import { Timeline } from "@/features/patients/components/Timeline";
import { Vitals } from "@/features/patients/components/Vitals";
import { AiSummary } from "@/features/patients/components/AiSummary";
import { SoapNotesCard } from "@/features/patients/components/SoapNotesCard";
import { MedicationsCard } from "@/features/patients/components/Medications";
import { Labs } from "@/features/patients/components/Labs";
import { ClinicalActions } from "@/features/patients/components/ClinicalActions";
import { usePatient } from "@/features/patients/hooks/use-patient";
import { soapNotes } from "@/mocks";

export function PatientProfilePage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const remove = useDeletePatient();
  const { data: patient, isLoading, isError, error, refetch, isFetching } = usePatient(
    patientId
  );

  return (
    <>
      <PageHeader
        title="Patient information"
        back
        onBack={() => navigate(-1)}
        right={
          patient && (
            <>
              <span className="text-xs text-muted-foreground mr-2">
                MRN {patient.mrn}
              </span>
              <Button
                variant="secondary"
                className="h-10"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-4" />
                Edit
              </Button>
              <Button
                variant="secondary"
                className="h-10 text-danger hover:text-danger"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 className="size-4" />
                Remove
              </Button>
            </>
          )
        }
      />

      {isLoading && <ProfileSkeleton />}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load patient"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && patient && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 space-y-4">
            <PatientHeader patient={patient} />
            <ImportantAlerts />
          </div>
          <div className="lg:col-span-5 space-y-4">
            <KeyClinicalOverview />
            <AiSummary
              summary={
                soapNotes[0].aiSummary ?? "AI summary unavailable — please regenerate."
              }
            />
            <SoapNotesCard />
            <Vitals />
            <MedicationsCard />
          </div>
          <div className="lg:col-span-3 space-y-4">
            <KeyDocuments />
            <ClinicalActions />
            <Timeline />
          </div>
          <div className="lg:col-span-12">
            <ChecklistCard />
          </div>
          <div className="lg:col-span-12">
            <Labs />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={patient ? `Remove ${patient.name}?` : "Remove patient?"}
        description="This will remove the patient record. This action can't be undone."
        confirmLabel="Remove patient"
        destructive
        busy={remove.isPending}
        onConfirm={async () => {
          if (!patient) return;
          await remove.mutateAsync(patient.id);
          setConfirmingDelete(false);
          navigate("/patients", { replace: true });
        }}
      />

      <PatientDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        patientId={patient?.id}
      />
    </>
  );
}
