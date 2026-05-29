/**
 * PatientChatDrawer — slide-in drawer wrapping the PatientChatThread.
 *
 * Opens from the floating FAB on the patient profile page.
 * Thread state is ephemeral (not persisted).
 */
import { Drawer } from "@/components/ui/drawer";
import { PatientChatThread } from "./PatientChatThread";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

export function PatientChatDrawer({
  open,
  onOpenChange,
  patientId,
  patientName,
}: Props) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Ask about ${patientName}`}
      description="AI-powered chart Q&A. Answers are based only on this patient's chart — citations show the source."
      size="md"
    >
      {/* Give the thread a fixed height so the composer sticks to the bottom */}
      <div className="h-full flex flex-col" style={{ minHeight: "calc(100vh - 120px)" }}>
        <PatientChatThread patientId={patientId} />
      </div>
    </Drawer>
  );
}
