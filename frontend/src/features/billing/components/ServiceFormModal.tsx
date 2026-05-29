import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import {
  useCreateService,
  useUpdateService,
} from "@/features/billing/hooks/use-services";
import type {
  ServiceCategory,
  ServiceItem,
} from "@/features/billing/api/services-api";

const CATEGORIES: ServiceCategory[] = [
  "visit",
  "procedure",
  "lab",
  "supply",
  "membership",
  "other",
];

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: ServiceItem | null;
}

export function ServiceFormModal({ open, onClose, editing }: Props) {
  const create = useCreateService();
  const update = useUpdateService(editing?.id ?? "");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ServiceCategory>("visit");
  const [priceDollars, setPriceDollars] = useState("0.00");
  const [taxable, setTaxable] = useState(false);
  const [taxRatePct, setTaxRatePct] = useState("0");

  useEffect(() => {
    if (!open) return;
    setCode(editing?.code ?? "");
    setName(editing?.name ?? "");
    setCategory(editing?.category ?? "visit");
    setPriceDollars(((editing?.priceCents ?? 0) / 100).toFixed(2));
    setTaxable(editing?.taxable ?? false);
    setTaxRatePct(((editing?.taxRateBp ?? 0) / 100).toFixed(2));
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = Math.round(parseFloat(priceDollars || "0") * 100);
    const taxBp = Math.round(parseFloat(taxRatePct || "0") * 100);
    if (Number.isNaN(cents) || cents < 0) return;

    if (editing) {
      await update.mutateAsync({
        name,
        category,
        price_cents: cents,
        tax_rate_bp: taxBp,
        taxable,
      });
    } else {
      await create.mutateAsync({
        code,
        name,
        category,
        price_cents: cents,
        tax_rate_bp: taxBp,
        taxable,
      });
    }
    onClose();
  };

  const busy = create.isPending || update.isPending;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white shadow-elev border border-border">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <Dialog.Title className="text-lg font-semibold">
              {editing ? "Edit service" : "Add service"}
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
            <FormField label="Code" htmlFor="svc-code" required>
              <Input
                id="svc-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase().slice(0, 32))
                }
                placeholder="VISIT-30"
                disabled={Boolean(editing)}
                required
              />
            </FormField>
            <FormField label="Name" htmlFor="svc-name" required>
              <Input
                id="svc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="30-minute follow-up visit"
                required
              />
            </FormField>
            <FormField label="Category" htmlFor="svc-category">
              <select
                id="svc-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ServiceCategory)}
                className="h-10 w-full rounded-full border border-border bg-white px-4 text-sm shadow-soft"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Price (USD)" htmlFor="svc-price" required>
              <Input
                id="svc-price"
                type="number"
                step="0.01"
                min="0"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Taxable">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={taxable}
                  onChange={(e) => setTaxable(e.target.checked)}
                  className="size-4"
                />
                Apply sales tax
              </label>
            </FormField>
            {taxable && (
              <FormField label="Tax rate (%)" htmlFor="svc-tax">
                <Input
                  id="svc-tax"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={taxRatePct}
                  onChange={(e) => setTaxRatePct(e.target.value)}
                />
              </FormField>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Save" : "Add"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
