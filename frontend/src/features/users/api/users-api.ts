import { api } from "@/lib/api-client";
import type { Role } from "@/types";

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  specialty: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BackendUserDto {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  specialty?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

interface BackendUserPage {
  items: BackendUserDto[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface UserPage {
  items: AppUser[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface UserFilters {
  q?: string;
  role?: Role;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

export interface UserCreateInput {
  email: string;
  full_name: string;
  role: Role;
  password: string;
  specialty?: string | null;
  avatar_url?: string | null;
}

export interface UserUpdateInput {
  full_name?: string;
  role?: Role;
  specialty?: string | null;
  avatar_url?: string | null;
  is_active?: boolean;
  /** Optional — blank/undefined leaves the existing password alone. */
  password?: string;
}

function mapUser(dto: BackendUserDto): AppUser {
  return {
    id: dto.id,
    email: dto.email,
    fullName: dto.full_name,
    role: dto.role,
    specialty: dto.specialty ?? null,
    avatarUrl: dto.avatar_url ?? null,
    isActive: dto.is_active,
    isVerified: dto.is_verified,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

export const usersApi = {
  list: async (filters: UserFilters): Promise<UserPage> => {
    const data = await api.get<BackendUserPage>("/users", {
      searchParams: {
        q: filters.q,
        role: filters.role,
        is_active: filters.is_active,
        page: filters.page,
        page_size: filters.page_size,
      },
    });
    return {
      items: data.items.map(mapUser),
      total: data.total,
      page: data.page,
      page_size: data.page_size,
      pages: data.pages,
    };
  },

  get: async (id: string): Promise<AppUser> => {
    const dto = await api.get<BackendUserDto>(`/users/${id}`);
    return mapUser(dto);
  },

  create: async (input: UserCreateInput): Promise<AppUser> => {
    const dto = await api.post<BackendUserDto>("/users", stripUndefined(input));
    return mapUser(dto);
  },

  update: async (id: string, input: UserUpdateInput): Promise<AppUser> => {
    const dto = await api.patch<BackendUserDto>(`/users/${id}`, stripUndefined(input));
    return mapUser(dto);
  },

  deactivate: (id: string): Promise<void> => api.delete(`/users/${id}`),
};
