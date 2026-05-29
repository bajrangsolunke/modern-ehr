import { api } from "@/lib/api-client";

export interface Invoice {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  issuedAt: string | null;
  dueAt: string | null;
}

interface BackendDto {
  id: string;
  number: string;
  status: string;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  issued_at: string | null;
  due_at: string | null;
}

const map = (d: BackendDto): Invoice => ({
  id: d.id,
  number: d.number,
  status: d.status,
  totalCents: d.total_cents,
  paidCents: d.paid_cents,
  balanceCents: d.balance_cents,
  issuedAt: d.issued_at,
  dueAt: d.due_at,
});

export interface StripeInit {
  paymentIntentId: string;
  clientSecret: string;
  publishableKey: string;
  amountCents: number;
}

export const billingApi = {
  list: async (): Promise<Invoice[]> =>
    (await api.get<BackendDto[]>("/patient-portal/me/invoices")).map(map),
  get: async (id: string): Promise<Invoice> =>
    map(await api.get<BackendDto>(`/patient-portal/me/invoices/${id}`)),
  initStripe: async (id: string): Promise<StripeInit> => {
    const d = await api.post<{
      payment_intent_id: string;
      client_secret: string;
      publishable_key: string;
      amount_cents: number;
    }>(`/patient-portal/me/invoices/${id}/stripe-init`);
    return {
      paymentIntentId: d.payment_intent_id,
      clientSecret: d.client_secret,
      publishableKey: d.publishable_key,
      amountCents: d.amount_cents,
    };
  },
};
