import { useState } from "react";
import { FileText, Plus, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import {
  invoicesApi,
  type Invoice,
  type InvoiceStatus,
} from "@/features/billing/api/invoices-api";
import {
  usePatientInvoices,
  useIssueInvoice,
} from "@/features/billing/hooks/use-invoices";
import { useInvoicePayments } from "@/features/billing/hooks/use-payments";
import { useOpenCharges } from "@/features/billing/hooks/use-charges";
import { AddChargeModal } from "./AddChargeModal";
import { TakeCashPaymentModal } from "./TakeCashPaymentModal";
import { ChargeCardModal } from "./ChargeCardModal";

const dollar = (c: number) => `$${(c / 100).toFixed(2)}`;

const statusTone: Record<InvoiceStatus, "warning" | "info" | "success" | "neutral" | "danger"> = {
  draft: "neutral",
  open: "warning",
  partially_paid: "info",
  paid: "success",
  void: "neutral",
  refunded: "danger",
};

interface Props {
  patientId: string;
}

export function PatientBillingTab({ patientId }: Props) {
  const invoices = usePatientInvoices(patientId);
  const issue = useIssueInvoice();
  const openCharges = useOpenCharges(patientId);
  const openRows = openCharges.data ?? [];
  const [addOpen, setAddOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [cardInvoice, setCardInvoice] = useState<Invoice | null>(null);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  const handleIssue = async () => {
    if (openRows.length === 0) return;
    await issue.mutateAsync({
      patient_id: patientId,
      charge_ids: openRows.map((c) => c.id),
    });
  };

  return (
    <div className="space-y-6">
      {/* Open charges section */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold">Open charges</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add charges, then issue an invoice for the patient.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" /> Add charge
            </Button>
            <Button
              size="sm"
              onClick={handleIssue}
              disabled={openRows.length === 0 || issue.isPending}
            >
              Issue invoice
            </Button>
          </div>
        </div>
        {openRows.length === 0 ? (
          <div className="p-5">
            <Empty
              icon={<Receipt className="size-5" />}
              title="No open charges"
              description="Add charges from the catalog or check past invoices below."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-surface-subtle">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Code</th>
                <th className="px-4 py-2 text-left font-medium">Description</th>
                <th className="px-4 py-2 text-right font-medium">Qty</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {openRows.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-mono text-xs">{c.code}</td>
                  <td className="px-4 py-2">{c.description}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.quantity}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    {dollar(c.totalCents)}
                  </td>
                </tr>
              ))}
              <tr className="bg-surface-subtle">
                <td colSpan={3} className="px-4 py-2 text-right text-xs uppercase tracking-wider text-muted-foreground">
                  Pending total
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-bold">
                  {dollar(openRows.reduce((s, c) => s + c.totalCents, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      {/* Invoices section */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Invoices</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            All invoices issued to this patient.
          </p>
        </div>
        {!invoices.isLoading && (invoices.data?.length ?? 0) === 0 && (
          <div className="p-5">
            <Empty
              icon={<FileText className="size-5" />}
              title="No invoices yet"
              description="Issue an invoice from the open charges above to get started."
            />
          </div>
        )}
        {(invoices.data?.length ?? 0) > 0 && (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-surface-subtle">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Number</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">Balance</th>
                <th className="px-4 py-2 text-right font-medium">{""}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.data!.map((inv) => (
                <InvoiceRow
                  key={inv.id}
                  inv={inv}
                  expanded={expandedInvoice === inv.id}
                  onToggle={() =>
                    setExpandedInvoice((prev) => (prev === inv.id ? null : inv.id))
                  }
                  onTakeCash={() => setPayingInvoice(inv)}
                  onChargeCard={() => setCardInvoice(inv)}
                  onReceipt={() => invoicesApi.openReceipt(inv.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <AddChargeModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        patientId={patientId}
      />

      <TakeCashPaymentModal
        open={Boolean(payingInvoice)}
        onClose={() => setPayingInvoice(null)}
        invoiceId={payingInvoice?.id ?? ""}
        balanceCents={payingInvoice?.balanceCents ?? 0}
      />

      <ChargeCardModal
        invoice={
          cardInvoice
            ? {
                id: cardInvoice.id,
                number: cardInvoice.number,
                balanceCents: cardInvoice.balanceCents,
              }
            : null
        }
        onClose={() => setCardInvoice(null)}
      />
    </div>
  );
}

function InvoiceRow({
  inv,
  expanded,
  onToggle,
  onTakeCash,
  onChargeCard,
  onReceipt,
}: {
  inv: Invoice;
  expanded: boolean;
  onToggle: () => void;
  onTakeCash: () => void;
  onChargeCard: () => void;
  onReceipt: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-surface-subtle/60 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-2 font-mono text-xs">{inv.number}</td>
        <td className="px-4 py-2">
          <Badge variant={statusTone[inv.status]} size="sm">
            {inv.status}
          </Badge>
        </td>
        <td className="px-4 py-2 text-right tabular-nums">{dollar(inv.totalCents)}</td>
        <td className="px-4 py-2 text-right tabular-nums font-medium">
          {dollar(inv.balanceCents)}
        </td>
        <td
          className="px-4 py-2 text-right whitespace-nowrap"
          onClick={(e) => e.stopPropagation()}
        >
          <Button size="sm" variant="ghost" onClick={onReceipt}>
            <Receipt className="size-3.5" />
            <span className="hidden sm:inline ml-1">Receipt</span>
          </Button>
          {inv.balanceCents > 0 &&
            inv.status !== "void" &&
            inv.status !== "refunded" && (
              <>
                <Button size="sm" variant="secondary" onClick={onChargeCard}>
                  Charge card
                </Button>
                <Button size="sm" onClick={onTakeCash}>
                  Take cash
                </Button>
              </>
            )}
        </td>
      </tr>
      {expanded && <PaymentsRow invoiceId={inv.id} />}
    </>
  );
}

function PaymentsRow({ invoiceId }: { invoiceId: string }) {
  const { data, isLoading } = useInvoicePayments(invoiceId);
  return (
    <tr>
      <td colSpan={5} className="bg-surface-subtle/40 px-4 py-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Payment history
        </div>
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="text-sm text-muted-foreground">No payments recorded.</div>
        )}
        {(data?.length ?? 0) > 0 && (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Date</th>
                <th className="px-2 py-1 text-left font-medium">Method</th>
                <th className="px-2 py-1 text-left font-medium">Status</th>
                <th className="px-2 py-1 text-right font-medium">Amount</th>
                <th className="px-2 py-1 text-left font-medium">Reference</th>
              </tr>
            </thead>
            <tbody>
              {data!.map((p) => (
                <tr key={p.id}>
                  <td className="px-2 py-1 tabular-nums">
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                  <td className="px-2 py-1">{p.method}</td>
                  <td className="px-2 py-1">{p.status}</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {dollar(p.amountCents)}
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">
                    {p.last4
                      ? `${p.cardBrand ?? ""} •••• ${p.last4}`
                      : p.reference ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </td>
    </tr>
  );
}
