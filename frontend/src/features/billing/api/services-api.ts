import { api } from "@/lib/api-client";

export type ServiceCategory =
  | "visit"
  | "procedure"
  | "lab"
  | "supply"
  | "membership"
  | "other";

export interface ServiceItem {
  id: string;
  code: string;
  name: string;
  category: ServiceCategory;
  priceCents: number;
  taxRateBp: number;
  taxable: boolean;
  isActive: boolean;
}

interface BackendDto {
  id: string;
  code: string;
  name: string;
  category: ServiceCategory;
  price_cents: number;
  tax_rate_bp: number;
  taxable: boolean;
  is_active: boolean;
}

interface BackendPage<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

const map = (d: BackendDto): ServiceItem => ({
  id: d.id,
  code: d.code,
  name: d.name,
  category: d.category,
  priceCents: d.price_cents,
  taxRateBp: d.tax_rate_bp,
  taxable: d.taxable,
  isActive: d.is_active,
});

export interface ServiceCreateInput {
  code: string;
  name: string;
  category: ServiceCategory;
  price_cents: number;
  tax_rate_bp?: number;
  taxable?: boolean;
}

export interface ServiceUpdateInput {
  name?: string;
  category?: ServiceCategory;
  price_cents?: number;
  tax_rate_bp?: number;
  taxable?: boolean;
}

export interface ServiceListResponse {
  items: ServiceItem[];
  total: number;
}

export const servicesApi = {
  list: async (
    opts: { q?: string; active_only?: boolean } = {},
  ): Promise<ServiceListResponse> => {
    const data = await api.get<BackendPage<BackendDto>>("/billing/services", {
      searchParams: {
        q: opts.q,
        active_only: opts.active_only ?? true,
      },
    });
    return { items: data.items.map(map), total: data.total };
  },

  create: async (input: ServiceCreateInput): Promise<ServiceItem> =>
    map(await api.post<BackendDto>("/billing/services", input)),

  update: async (
    id: string,
    input: ServiceUpdateInput,
  ): Promise<ServiceItem> =>
    map(await api.patch<BackendDto>(`/billing/services/${id}`, input)),

  deactivate: (id: string): Promise<void> =>
    api.delete<void>(`/billing/services/${id}`),
};
