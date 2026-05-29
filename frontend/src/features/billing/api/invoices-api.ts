import { api } from "@/lib/api-client";
import { env } from "@/config/env";
import { STORAGE_KEYS } from "@/config/constants";

export type InvoiceStatus =
  | "draft"
  | "open"
  | "partially_paid"
  | "paid"
  | "void"
  | "refunded";

export interface Invoice {
  id: string;
  number: string;
  patientId: string;
  status: InvoiceStatus;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  issuedAt: string | null;
  dueAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface BackendDto {
  id: string;
  number: string;
  patient_id: string;
  status: InvoiceStatus;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  issued_at: string | null;
  due_at: string | null;
  notes: string | null;
  created_at: string;
}

const map = (d: BackendDto): Invoice => ({
  id: d.id,
  number: d.number,
  patientId: d.patient_id,
  status: d.status,
  subtotalCents: d.subtotal_cents,
  discountCents: d.discount_cents,
  taxCents: d.tax_cents,
  totalCents: d.total_cents,
  paidCents: d.paid_cents,
  balanceCents: d.balance_cents,
  issuedAt: d.issued_at,
  dueAt: d.due_at,
  notes: d.notes,
  createdAt: d.created_at,
});

export interface InvoiceIssueInput {
  patient_id: string;
  charge_ids: string[];
  discount_cents?: number;
  notes?: string;
}

export const invoicesApi = {
  listForPatient: async (patientId: string): Promise<Invoice[]> => {
    const data = await api.get<BackendDto[]>(
      `/billing/invoices/by-patient/${patientId}`,
    );
    return data.map(map);
  },

  get: async (id: string): Promise<Invoice> =>
    map(await api.get<BackendDto>(`/billing/invoices/${id}`)),

  issue: async (input: InvoiceIssueInput): Promise<Invoice> =>
    map(await api.post<BackendDto>("/billing/invoices", input)),

  /**
   * Open the receipt PDF in a new tab. Uses Bearer-auth fetch + blob URL
   * because the endpoint requires Authorization and `window.open` with a
   * naked URL would not include it.
   */
  openReceipt: (id: string): void => {
    const token = localStorage.getItem(STORAGE_KEYS.accessToken);
    if (!token) return;
    void fetch(`${env.API_BASE_URL}/billing/invoices/${id}/receipt.pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      });
  },
};
