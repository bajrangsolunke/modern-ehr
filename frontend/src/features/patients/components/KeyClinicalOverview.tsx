import { Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const rows = [
  { k: "Language", v: "Native german speaker" },
  { k: "Allergies", v: "Latex, Penicillin" },
  { k: "Pre-existing conditions", v: "Diabetes Type II, Hypertonie" },
  { k: "Medications", v: "Apixaban, Metformin" },
  { k: "DNR / DNI", v: "Active" },
  { k: "ASA classification", v: "ASA III", extra: "Uploaded 21.03.2025" },
  {
    k: "ICU need",
    v: "Required",
    pill: { label: "Confirmation pending", variant: "warning" as const },
  },
  { k: "Last lab date", v: "Hb/INR", extra: "Last updated: 12.01.2025" },
];

export function KeyClinicalOverview() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Key clinical overview</CardTitle>
        <Button variant="ghost" size="icon" className="size-7">
          <Pencil className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 pb-5">
        {rows.map((r) => (
          <div
            key={r.k}
            className="flex items-center justify-between gap-2 bg-surface-subtle rounded-xl px-3.5 py-2 text-sm"
          >
            <span className="text-muted-foreground">{r.k}:</span>
            <div className="flex items-center gap-2 text-right">
              <span className="font-semibold">{r.v}</span>
              {r.extra && <span className="text-xs text-muted-foreground">({r.extra})</span>}
              {r.pill && (
                <Badge variant={r.pill.variant} dot size="sm">
                  {r.pill.label}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
