import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  billingApi,
  type Invoice,
  type StripeInit,
} from "../api/billing-api";
import { useInvalidateInvoices } from "../hooks/use-billing";
import { toast } from "@/lib/toast";

interface Props {
  invoice: Invoice | null;
  onClose: () => void;
}

const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;

export function PayInvoiceModal({ invoice, onClose }: Props) {
  const [init, setInit] = useState<StripeInit | null>(null);
  const [stripePromise, setStripePromise] =
    useState<Promise<Stripe | null> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoice) {
      setInit(null);
      setStripePromise(null);
      setError(null);
      return;
    }
    setInit(null);
    setError(null);
    billingApi
      .initStripe(invoice.id)
      .then((d) => {
        setInit(d);
        setStripePromise(
          loadStripe(d.publishableKey, {
            // Suppress the test-mode dev assistant widget that pins to
            // the bottom-right of the page.
            developerTools: { assistant: { enabled: false } },
          } as Parameters<typeof loadStripe>[1]),
        );
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Couldn't start payment"),
      );
  }, [invoice]);

  return (
    <Dialog.Root
      open={Boolean(invoice)}
      onOpenChange={(o) => !o && onClose()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white shadow-elev border border-border max-h-[92vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-white z-10">
            <Dialog.Title className="text-lg font-semibold">
              Pay invoice {invoice?.number}
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
          <div className="p-5 space-y-4">
            <div className="text-3xl font-bold tabular-nums">
              {invoice && dollars(invoice.balanceCents)}
            </div>
            {error && <div className="text-sm text-danger">{error}</div>}
            {!init && !error && (
              <div className="grid place-items-center py-8">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            )}
            {init && stripePromise && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: init.clientSecret,
                  appearance: { theme: "flat" },
                }}
              >
                <PaymentForm onSuccess={onClose} />
              </Elements>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const invalidate = useInvalidateInvoices();
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    setSubmitting(false);
    if (error) {
      toast.error("Payment failed", {
        description: error.message ?? undefined,
      });
      return;
    }
    toast.success("Payment received");
    invalidate();
    onSuccess();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
          wallets: { applePay: "never", googlePay: "never" },
          fields: {
            billingDetails: {
              email: "never",
              phone: "never",
              name: "never",
              address: "never",
            },
          },
        }}
      />
      <Button type="submit" className="w-full" disabled={!stripe || submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        Pay now
      </Button>
      <p className="text-[11px] text-muted-foreground text-center">
        Payments processed by Stripe. We never see your card number.
      </p>
    </form>
  );
}
