import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { useRecordCash } from "@/features/billing/hooks/use-payments";

interface Props {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  balanceCents: number;
}

export function TakeCashPaymentModal({
  open,
  onClose,
  invoiceId,
  balanceCents,
}: Props) {
  const record = useRecordCash();
  const [amountDollars, setAmountDollars] = useState("");
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmountDollars((balanceCents / 100).toFixed(2));
    setReference("");
  }, [open, balanceCents]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = Math.round(parseFloat(amountDollars || "0") * 100);
    if (!cents || cents <= 0) return;
    await record.mutateAsync({
      invoice_id: invoiceId,
      amount_cents: cents,
      reference: reference || undefined,
    });
    onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white shadow-elev border border-border">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <Dialog.Title className="text-lg font-semibold">
              Take cash payment
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="size-8 rounded-full grid place-items-center hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          <form onSubmit={submit} className="p-5 space-y-4">
            <div className="text-sm text-muted-foreground">
              Balance: <span className="tabular-nums font-medium">${(balanceCents / 100).toFixed(2)}</span>
            </div>
            <FormField label="Amount (USD)" htmlFor="pay-amount" required>
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Reference" htmlFor="pay-ref" hint="Optional. Drawer, check number, etc.">
              <Input
                id="pay-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Drawer A"
                maxLength={64}
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={record.isPending}>
                {record.isPending && <Loader2 className="size-4 animate-spin" />}
                Record payment
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
