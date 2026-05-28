import { api } from "@/lib/api-client";
import type { PatientMe } from "@/stores/auth-store";

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface SetupVerifyOut {
  first_name: string;
  masked_email: string;
}

export const authApi = {
  setupVerify: (token: string): Promise<SetupVerifyOut> =>
    api.post<SetupVerifyOut>(
      "/patient-auth/setup-verify",
      { token },
      { skipAuth: true }
    ),

  setup: (input: { token: string; password: string }): Promise<Tokens> =>
    api.post<Tokens>("/patient-auth/setup", input, { skipAuth: true }),

  login: (input: { email: string; password: string }): Promise<Tokens> =>
    api.post<Tokens>("/patient-auth/login", input, { skipAuth: true }),

  requestReset: (email: string): Promise<void> =>
    api.post<void>(
      "/patient-auth/request-reset",
      { email },
      { skipAuth: true }
    ),

  reset: (input: { token: string; password: string }): Promise<Tokens> =>
    api.post<Tokens>("/patient-auth/reset", input, { skipAuth: true }),

  me: (): Promise<PatientMe> => api.get<PatientMe>("/patient-portal/me"),
};
