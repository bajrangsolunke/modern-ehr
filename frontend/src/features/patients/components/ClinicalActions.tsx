import { CalendarPlus, FilePlus, MessageSquarePlus, PenSquare, Stethoscope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

interface Props {
  /** Switch to a profile tab. Provided by the parent page. */
  onGoToTab?: (tab: "notes" | "documents") => void;
}

export function ClinicalActions({ onGoToTab }: Props = {}) {
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
      onClick: () =>
        toast.info("Scheduling coming soon", {
          description: "Visit scheduling will live in the appointments tab.",
        }),
    },
    {
      label: "Upload doc",
      icon: FilePlus,
      onClick: () =>
        onGoToTab
          ? onGoToTab("documents")
          : toast.info("Open the Documents tab to add a file."),
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
  );
}
