import { api } from "@/lib/api-client";
import { stripUndefined } from "@/lib/api-utils";
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

export interface UserStats {
  patientCount: number;
  upcomingAppointments: number;
  completedAppointments: number;
}

interface BackendUserStats {
  patient_count: number;
  upcoming_appointments: number;
  completed_appointments: number;
}

export interface UserAppointment {
  id: string;
  patientId: string;
  type: string;
  status: string;
  startsAt: string;
  durationMinutes: number;
  room: string | null;
}

interface BackendAppointment {
  id: string;
  patient_id: string;
  type: string;
  status: string;
  starts_at: string;
  duration_minutes: number;
  room?: string | null;
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

  /** Open to any active staff member — used by the task assignee
   *  picker, appointment provider picker, and other "assign to
   *  someone" flows so non-admin providers + staff can pick a
   *  teammate without needing admin access to /users. */
  listAssignable: async (
    filters: Pick<UserFilters, "q" | "role" | "page" | "page_size">
  ): Promise<UserPage> => {
    const data = await api.get<BackendUserPage>("/users/assignable", {
      searchParams: {
        q: filters.q,
        role: filters.role,
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

  stats: async (id: string): Promise<UserStats> => {
    const dto = await api.get<BackendUserStats>(`/users/${id}/stats`);
    return {
      patientCount: dto.patient_count,
      upcomingAppointments: dto.upcoming_appointments,
      completedAppointments: dto.completed_appointments,
    };
  },

  appointments: async (id: string, limit = 20): Promise<UserAppointment[]> => {
    const data = await api.get<BackendAppointment[]>(`/users/${id}/appointments`, {
      searchParams: { limit },
    });
    return data.map((a) => ({
      id: a.id,
      patientId: a.patient_id,
      type: a.type,
      status: a.status,
      startsAt: a.starts_at,
      durationMinutes: a.duration_minutes,
      room: a.room ?? null,
    }));
  },
};
