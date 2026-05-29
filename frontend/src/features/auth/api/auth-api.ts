import { api } from "@/lib/api-client";
import { stripUndefined } from "@/lib/api-utils";
import type { User } from "@/types";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
}

interface BackendUserDto {
  id: string;
  email: string;
  full_name: string;
  role: string;
  specialty?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  is_verified: boolean;
}

function mapUser(dto: BackendUserDto): User {
  return {
    id: dto.id,
    name: dto.full_name,
    email: dto.email,
    role: dto.role as User["role"],
    specialty: dto.specialty ?? undefined,
    avatarUrl: dto.avatar_url ?? undefined,
  };
}

function toBackendDto(user: User): BackendUserDto {
  return {
    id: user.id,
    email: user.email,
    full_name: user.name,
    role: user.role,
    specialty: user.specialty ?? null,
    avatar_url: user.avatarUrl ?? null,
    is_active: true,
    is_verified: true,
  };
}

export interface SelfUpdateInput {
  full_name?: string;
  specialty?: string | null;
  avatar_url?: string | null;
}

export interface PasswordChangeInput {
  current_password: string;
  new_password: string;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<TokenResponse>("/auth/login/json", payload, { skipAuth: true }),

  me: async (demoFallback?: () => User): Promise<User> => {
    const dto = await api.get<BackendUserDto>("/auth/me", {
      demoFallback: demoFallback ? () => toBackendDto(demoFallback()) : undefined,
    });
    return mapUser(dto);
  },

  updateMe: async (input: SelfUpdateInput): Promise<User> => {
    const dto = await api.patch<BackendUserDto>("/auth/me", stripUndefined(input));
    return mapUser(dto);
  },

  changePassword: (input: PasswordChangeInput): Promise<void> =>
    api.post("/auth/me/password", input),

  // ---- Staff account setup (invite flow) ----

  setupInfo: (token: string): Promise<{ full_name: string; email_masked: string; role: string }> =>
    api.get("/auth/setup-info", { searchParams: { token }, skipAuth: true }),

  setup: (payload: { token: string; password: string }): Promise<TokenResponse> =>
    api.post("/auth/setup", payload, { skipAuth: true }),
};
