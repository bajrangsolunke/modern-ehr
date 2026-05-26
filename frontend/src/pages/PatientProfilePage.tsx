import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { PatientHeader } from "@/components/patients/PatientHeader";
import { KeyClinicalOverview } from "@/components/patients/KeyClinicalOverview";
import { KeyDocuments } from "@/components/patients/KeyDocuments";
import { ImportantAlerts } from "@/components/patients/ImportantAlerts";
import { ChecklistCard } from "@/components/patients/Checklist";
import { Timeline } from "@/components/patients/Timeline";
import { Vitals } from "@/components/patients/Vitals";
import { AiSummary } from "@/components/patients/AiSummary";
import { SoapNotesCard } from "@/components/patients/SoapNotesCard";
import { MedicationsCard } from "@/components/patients/Medications";
import { Labs } from "@/components/patients/Labs";
import { ClinicalActions } from "@/components/patients/ClinicalActions";
import { patients, soapNotes } from "@/data/mock";

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
