import { CalendarPlus, FilePlus, MessageSquarePlus, PenSquare, Stethoscope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const actions = [
  { label: "Add SOAP note", icon: PenSquare },
  { label: "Order test", icon: Stethoscope },
  { label: "Schedule visit", icon: CalendarPlus },
  { label: "Upload doc", icon: FilePlus },
  { label: "Message team", icon: MessageSquarePlus },
];

export function ClinicalActions() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Clinical actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-5">
        {actions.map(({ label, icon: Icon }) => (
          <Button key={label} variant="secondary" className="w-full justify-start">
            <Icon className="size-3.5" />
            {label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
