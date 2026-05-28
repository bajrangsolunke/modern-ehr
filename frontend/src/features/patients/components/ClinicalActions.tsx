import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarPlus, FilePlus, MessageSquarePlus, Mic, PenSquare, Stethoscope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { DocumentUploadModal } from "@/features/docs/components/DocumentUploadModal";

interface Props {
  patientId: string;
  /** Switch to a profile tab. Provided by the parent page. */
  onGoToTab?: (tab: "notes" | "forms" | "documents") => void;
}

export function ClinicalActions({ patientId, onGoToTab }: Props) {
  const navigate = useNavigate();
  const [uploadOpen, setUploadOpen] = useState(false);

  const actions: Array<{
    label: string;
    icon: typeof PenSquare;
    onClick: () => void;
  }> = [
    {
      label: "Add SOAP note",
      icon: PenSquare,
      onClick: () =>
        onGoToTab
          ? onGoToTab("notes")
          : toast.info("Open the Clinical notes tab to add a SOAP note."),
    },
    {
      label: "Start ambient scribe",
      icon: Mic,
      onClick: () => navigate(`/patients/${patientId}/scribe`),
    },
    {
      label: "Order test",
      icon: Stethoscope,
      onClick: () =>
        toast.info("Order entry coming soon", {
          description: "CPOE workflow lands with the upcoming labs / orders story.",
        }),
    },
    {
      label: "Schedule visit",
      icon: CalendarPlus,
      onClick: () => {
        // Deep-link to the appointments page with create modal pre-selected
        // for this patient. AppointmentsPage reads `new=1` + `patientId`
        // from the URL on mount and auto-opens the modal.
        navigate(`/appointments?new=1&patientId=${patientId}&fromPatient=1`);
      },
    },
    {
      label: "Upload doc",
      icon: FilePlus,
      onClick: () => setUploadOpen(true),
    },
    {
      label: "Message team",
      icon: MessageSquarePlus,
      onClick: () =>
        toast.info("Team messaging coming soon", {
          description: "Care-team chat will appear in the right rail.",
        }),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Clinical actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pb-5">
          {actions.map(({ label, icon: Icon, onClick }) => (
            <Button
              key={label}
              variant="secondary"
              className="w-full justify-start"
              onClick={onClick}
            >
              <Icon className="size-3.5" />
              {label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <DocumentUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultPatientId={patientId}
      />
    </>
  );
}
