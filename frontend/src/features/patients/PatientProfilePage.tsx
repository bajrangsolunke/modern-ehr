import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { patients, soapNotes } from "@/mocks";

export function PatientProfilePage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const patient =
    patients.find((p) => p.id === patientId) ??
    patients.find((p) => p.id === "p-1012") ??
    patients[0];

  return (
    <>
      <PageHeader
        title="Patient information"
        back
        onBack={() => navigate(-1)}
        right={<span className="text-xs text-muted-foreground">MRN {patient.mrn}</span>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 space-y-4">
          <PatientHeader patient={patient} />
          <ImportantAlerts />
        </div>
        <div className="lg:col-span-5 space-y-4">
          <KeyClinicalOverview />
          <AiSummary
            summary={
              soapNotes[0].aiSummary ??
              "AI summary unavailable — please regenerate."
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
    </>
  );
}
