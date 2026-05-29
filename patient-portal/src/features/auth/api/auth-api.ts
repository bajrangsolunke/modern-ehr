import { api } from "@/lib/api-client";
import { env } from "@/config/env";
import type {
  AIHealthSummary,
  PatientMe,
  PatientPreferences,
} from "@/types";

export interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
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

  updateMe: (patch: PatientSelfUpdate): Promise<PatientMe> =>
    api.patch<PatientMe>("/patient-portal/me", patch),

  updateAvatar: (avatarUrl: string | null): Promise<PatientMe> =>
    api.post<PatientMe>("/patient-portal/me/avatar", {
      avatar_url: avatarUrl,
    }),

  changePassword: (current: string, next: string): Promise<void> =>
    api.post<void>("/patient-portal/me/password", {
      current_password: current,
      new_password: next,
    }),

  getPreferences: (): Promise<PatientPreferences> =>
    api.get<PatientPreferences>("/patient-portal/me/preferences"),

  updatePreferences: (
    patch: Partial<PatientPreferences>
  ): Promise<PatientPreferences> =>
    api.put<PatientPreferences>("/patient-portal/me/preferences", patch),

  getAISummary: (): Promise<AIHealthSummary> =>
    api.get<AIHealthSummary>("/patient-portal/me/ai-summary"),

  /** Absolute URL for the medical summary download — used as href on an
   *  <a download> so the browser handles the Save dialog natively. */
  medicalSummaryUrl: (): string =>
    `${env.API_BASE_URL}/patient-portal/me/medical-summary`,
};

export interface PatientSelfUpdate {
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  dob?: string | null;

  blood_group?: string | null;
  gender_identity?: string | null;
  preferred_pronouns?: string | null;

  mailing_address_line1?: string | null;
  mailing_address_line2?: string | null;
  mailing_city?: string | null;
  mailing_state?: string | null;
  mailing_postal_code?: string | null;
  mailing_country?: string | null;

  physical_same_as_mailing?: boolean;
  physical_address_line1?: string | null;
  physical_address_line2?: string | null;
  physical_city?: string | null;
  physical_state?: string | null;
  physical_postal_code?: string | null;
  physical_country?: string | null;

  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
}
