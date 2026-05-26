import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PatientDrawer } from "@/features/patients/components/PatientDrawer";
import { ProfileSkeleton } from "@/features/patients/components/ProfileSkeleton";
import { AlertsStrip } from "@/features/patients/components/AlertsStrip";
import { PatientHeader } from "@/features/patients/components/PatientHeader";
import { KeyClinicalOverview } from "@/features/patients/components/KeyClinicalOverview";
import { KeyDocuments } from "@/features/patients/components/KeyDocuments";
import { ChecklistCard } from "@/features/patients/components/Checklist";
import { Timeline } from "@/features/patients/components/Timeline";
import { Vitals } from "@/features/patients/components/Vitals";
import { AiSummary } from "@/features/patients/components/AiSummary";
import { SoapNotesCard } from "@/features/patients/components/SoapNotesCard";
import { MedicationsCard } from "@/features/patients/components/Medications";
import { Labs } from "@/features/patients/components/Labs";
import { ClinicalActions } from "@/features/patients/components/ClinicalActions";
import { useDeletePatient } from "@/features/patients/hooks/use-delete-patient";
import { usePatient } from "@/features/patients/hooks/use-patient";
import { soapNotes } from "@/mocks";

/**
 * Tab-based patient profile. URL syncs ?tab= so links are shareable.
 * Patient header + alerts strip stay visible across tabs.
 *
 * Layout reasoning:
 * - Overview lands first because most profile opens are quick reads, not
 *   deep dives.
 * - Clinical notes, Vitals & labs, Medications, Documents, Care plan are
 *   the deep tabs — each maps to a discrete task ("write SOAP", "log
 *   vitals", "review labs", "upload consent", "case planning"), so
 *   separating them removes scroll fatigue from the old one-big-page
 *   layout.
 */
const TABS = [
  { value: "overview", label: "Overview" },
  { value: "notes", label: "Clinical notes" },
  { value: "vitals", label: "Vitals & Labs" },
  { value: "medications", label: "Medications" },
  { value: "documents", label: "Documents" },
  { value: "care-plan", label: "Care plan" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export function PatientProfilePage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const remove = useDeletePatient();
  const { data: patient, isLoading, isError, error, refetch, isFetching } =
    usePatient(patientId);

  const activeTab = (searchParams.get("tab") as TabValue | null) ?? "overview";
  const setTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === "overview") next.delete("tab");
    else next.set("tab", v);
    setSearchParams(next, { replace: true });
  };

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
        <div className="space-y-4">
          {/* Patient header + alerts strip — always visible above the tabs */}
          <div className="space-y-4">
            <PatientHeader patient={patient} />
            <AlertsStrip patientId={patient.id} />
          </div>

          <Tabs value={activeTab} onValueChange={setTab} className="space-y-4">
            <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
              <TabsList className="bg-white border border-border shadow-soft p-1 h-auto">
                {TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="text-sm">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="overview" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8 space-y-4">
                  <AiSummary
                    summary={
                      soapNotes[0].aiSummary ??
                      "AI summary unavailable — please regenerate."
                    }
                  />
                  <KeyClinicalOverview onEdit={() => setEditOpen(true)} />
                </div>
                <div className="lg:col-span-4 space-y-4">
                  <ClinicalActions onGoToTab={setTab} />
                  <Timeline />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8">
                  <SoapNotesCard patientId={patient.id} />
                </div>
                <div className="lg:col-span-4 space-y-4">
                  <ClinicalActions onGoToTab={setTab} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="vitals" className="mt-0">
              <div className="grid grid-cols-1 gap-4">
                <Vitals patientId={patient.id} />
                <Labs />
              </div>
            </TabsContent>

            <TabsContent value="medications" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8">
                  <MedicationsCard patientId={patient.id} />
                </div>
                <div className="lg:col-span-4 space-y-4">
                  <ClinicalActions onGoToTab={setTab} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
              <KeyDocuments />
            </TabsContent>

            <TabsContent value="care-plan" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8">
                  <ChecklistCard />
                </div>
                <div className="lg:col-span-4 space-y-4">
                  <Timeline />
                </div>
              </div>
            </TabsContent>
          </Tabs>
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
