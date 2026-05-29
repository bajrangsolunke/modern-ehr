import { useState } from "react";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { useInvoices } from "./hooks/use-billing";
import { PayInvoiceModal } from "./components/PayInvoiceModal";
import type { Invoice } from "./api/billing-api";

const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;

const statusTone: Record<
  string,
  "warning" | "success" | "neutral" | "danger" | "info"
> = {
  open: "warning",
  partially_paid: "info",
  paid: "success",
  void: "neutral",
  refunded: "danger",
};

export function BillingPage() {
  const { data, isLoading } = useInvoices();
  const [paying, setPaying] = useState<Invoice | null>(null);

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle="Invoices and payment history."
      />
      {!isLoading && data && data.length === 0 && (
        <Empty
          icon={<Receipt className="size-5" />}
          title="No invoices yet"
          description="Anything you owe will appear here."
        />
      )}
      {data && data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-surface-subtle">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Invoice</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
                <th className="px-4 py-3 text-right font-medium">{""}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2 font-mono text-xs">{inv.number}</td>
                  <td className="px-4 py-2">
                    <Badge
                      variant={statusTone[inv.status] ?? "neutral"}
                      size="sm"
                    >
                      {inv.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {dollars(inv.totalCents)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    {dollars(inv.balanceCents)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {inv.balanceCents > 0 && (
                      <Button size="sm" onClick={() => setPaying(inv)}>
                        Pay now
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <PayInvoiceModal invoice={paying} onClose={() => setPaying(null)} />
    </>
  );
}
