import { api } from "@/lib/api-client";
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

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<TokenResponse>("/auth/login/json", payload, { skipAuth: true }),

  me: (demoFallback?: () => User) =>
    api
      .get<BackendUserDto>("/auth/me", {
        demoFallback: demoFallback as (() => unknown) | undefined,
      })
      .then((data) => (typeof data === "object" && "id" in data ? mapUser(data) : (data as unknown as User))),
};
