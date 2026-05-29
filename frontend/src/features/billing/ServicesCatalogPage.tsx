import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";
import {
  useDeactivateService,
  useServices,
} from "./hooks/use-services";
import { ServiceFormModal } from "./components/ServiceFormModal";
import type { ServiceItem } from "./api/services-api";

const dollar = (c: number) => `$${(c / 100).toFixed(2)}`;

export function ServicesCatalogPage() {
  const { data, isLoading } = useServices(true);
  const deactivate = useDeactivateService();
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [open, setOpen] = useState(false);

  const handleNew = () => {
    setEditing(null);
    setOpen(true);
  };

  const handleEdit = (s: ServiceItem) => {
    setEditing(s);
    setOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Services & Pricing"
        subtitle="The price list your providers and front desk pick from."
        right={
          <Button onClick={handleNew}>
            <Plus className="size-4" /> Add service
          </Button>
        }
      />

      {!isLoading && data && data.items.length === 0 && (
        <Empty
          title="No services yet"
          description="Add your first billable service to get started."
        />
      )}

      {data && data.items.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-surface-subtle">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">{""}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((s) => (
                <tr key={s.id} className="hover:bg-surface-subtle/60">
                  <td className="px-4 py-2 font-mono text-xs">{s.code}</td>
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2">
                    <Badge size="sm">{s.category}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {dollar(s.priceCents)}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(s)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deactivate.mutate(s.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ServiceFormModal
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
      />
    </>
  );
}
