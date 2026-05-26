import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { labs } from "@/data/mock";
import { cn } from "@/lib/utils";

const flagMap = {
  H: { label: "High", cls: "bg-danger/10 text-danger" },
  L: { label: "Low", cls: "bg-info/10 text-info" },
  C: { label: "Critical", cls: "bg-rose-100 text-rose-700" },
};

export function Labs() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Labs & Imaging</CardTitle>
        <button className="text-xs text-primary hover:underline flex items-center gap-0.5">
          View all <ChevronRight className="size-3" />
        </button>
      </CardHeader>
      <CardContent className="pb-5">
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-xs text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Test</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Range</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Flag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {labs.map((l) => (
                <tr key={l.id} className="hover:bg-surface-subtle/70">
                  <td className="px-3 py-2 font-medium">{l.name}</td>
                  <td className="px-3 py-2">
                    {l.value} <span className="text-muted-foreground text-xs">{l.unit}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{l.range}</td>
                  <td className="px-3 py-2 text-muted-foreground">{l.collectedAt}</td>
                  <td className="px-3 py-2">
                    {l.flag ? (
                      <Badge size="sm" className={cn(flagMap[l.flag].cls)}>
                        {flagMap[l.flag].label}
                      </Badge>
                    ) : (
                      <Badge variant="success" size="sm">
                        Normal
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
