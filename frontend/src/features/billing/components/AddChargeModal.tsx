import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { useServices } from "@/features/billing/hooks/use-services";
import { useCreateCharge } from "@/features/billing/hooks/use-charges";

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
}

export function AddChargeModal({ open, onClose, patientId }: Props) {
  const { data: catalog, isLoading } = useServices(true);
  const create = useCreateCharge();
  const [serviceId, setServiceId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [discountDollars, setDiscountDollars] = useState("0.00");

  useEffect(() => {
    if (!open) return;
    setServiceId("");
    setQuantity(1);
    setDiscountDollars("0.00");
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId) return;
    const discount_cents = Math.round(parseFloat(discountDollars || "0") * 100);
    await create.mutateAsync({
      patient_id: patientId,
      service_catalog_id: serviceId,
      quantity,
      discount_cents: Number.isNaN(discount_cents) ? 0 : discount_cents,
    });
    onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white shadow-elev border border-border">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <Dialog.Title className="text-lg font-semibold">Add charge</Dialog.Title>
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
            <FormField label="Service" htmlFor="charge-service" required>
              <select
                id="charge-service"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="h-10 w-full rounded-full border border-border bg-white px-4 text-sm shadow-soft"
                required
                disabled={isLoading}
              >
                <option value="">Choose a service…</option>
                {catalog?.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name} · ${(s.priceCents / 100).toFixed(2)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Quantity" htmlFor="charge-qty">
              <Input
                id="charge-qty"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value || "1", 10))}
              />
            </FormField>
            <FormField label="Discount (USD)" htmlFor="charge-discount">
              <Input
                id="charge-discount"
                type="number"
                step="0.01"
                min="0"
                value={discountDollars}
                onChange={(e) => setDiscountDollars(e.target.value)}
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending || !serviceId}>
                {create.isPending && <Loader2 className="size-4 animate-spin" />}
                Add charge
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
