import { api } from "@/lib/api-client";

export interface Charge {
  id: string;
  patientId: string;
  encounterId: string | null;
  appointmentId: string | null;
  serviceCatalogId: string | null;
  description: string;
  code: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  invoiceId: string | null;
  voidedAt: string | null;
  createdAt: string;
}

interface BackendDto {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  appointment_id: string | null;
  service_catalog_id: string | null;
  description: string;
  code: string;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  invoice_id: string | null;
  voided_at: string | null;
  created_at: string;
}

const map = (d: BackendDto): Charge => ({
  id: d.id,
  patientId: d.patient_id,
  encounterId: d.encounter_id,
  appointmentId: d.appointment_id,
  serviceCatalogId: d.service_catalog_id,
  description: d.description,
  code: d.code,
  quantity: d.quantity,
  unitPriceCents: d.unit_price_cents,
  discountCents: d.discount_cents,
  taxCents: d.tax_cents,
  totalCents: d.total_cents,
  invoiceId: d.invoice_id,
  voidedAt: d.voided_at,
  createdAt: d.created_at,
});

export interface ChargeCreateInput {
  patient_id: string;
  service_catalog_id?: string;
  description?: string;
  code?: string;
  unit_price_cents?: number;
  quantity?: number;
  discount_cents?: number;
}

export const chargesApi = {
  create: async (input: ChargeCreateInput): Promise<Charge> =>
    map(await api.post<BackendDto>("/billing/charges", input)),
  listForPatient: async (
    patientId: string,
    opts: { openOnly?: boolean } = {},
  ): Promise<Charge[]> => {
    const data = await api.get<BackendDto[]>(
      `/billing/charges/by-patient/${patientId}`,
      { searchParams: { open_only: opts.openOnly ?? false } },
    );
    return data.map(map);
  },
  void: async (chargeId: string, reason: string): Promise<Charge> =>
    map(
      await api.post<BackendDto>(`/billing/charges/${chargeId}/void`, {
        reason,
      }),
    ),
};
