import { api } from "@/lib/api-client";

export type PaymentMethod =
  | "cash"
  | "check"
  | "card_present"
  | "stripe"
  | "adjustment";
export type PaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface Payment {
  id: string;
  invoiceId: string;
  patientId: string;
  method: PaymentMethod;
  amountCents: number;
  status: PaymentStatus;
  last4: string | null;
  cardBrand: string | null;
  reference: string | null;
  createdAt: string;
}

interface BackendDto {
  id: string;
  invoice_id: string;
  patient_id: string;
  method: PaymentMethod;
  amount_cents: number;
  status: PaymentStatus;
  last4: string | null;
  card_brand: string | null;
  reference: string | null;
  created_at: string;
}

const map = (d: BackendDto): Payment => ({
  id: d.id,
  invoiceId: d.invoice_id,
  patientId: d.patient_id,
  method: d.method,
  amountCents: d.amount_cents,
  status: d.status,
  last4: d.last4,
  cardBrand: d.card_brand,
  reference: d.reference,
  createdAt: d.created_at,
});

export interface CashPaymentInput {
  invoice_id: string;
  amount_cents: number;
  reference?: string;
}

export interface StripeInit {
  paymentIntentId: string;
  clientSecret: string;
  publishableKey: string;
  amountCents: number;
}

export const paymentsApi = {
  listForInvoice: async (invoiceId: string): Promise<Payment[]> => {
    const data = await api.get<BackendDto[]>(
      `/billing/payments/by-invoice/${invoiceId}`,
    );
    return data.map(map);
  },
  recordCash: async (input: CashPaymentInput): Promise<Payment> =>
    map(await api.post<BackendDto>("/billing/payments/cash", input)),
  initStripe: async (invoiceId: string): Promise<StripeInit> => {
    const d = await api.post<{
      payment_intent_id: string;
      client_secret: string;
      publishable_key: string;
      amount_cents: number;
    }>("/billing/payments/stripe/init", { invoice_id: invoiceId });
    return {
      paymentIntentId: d.payment_intent_id,
      clientSecret: d.client_secret,
      publishableKey: d.publishable_key,
      amountCents: d.amount_cents,
    };
  },
};
