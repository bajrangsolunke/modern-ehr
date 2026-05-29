export interface PatientMe {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  avatar_url: string | null;

  // Extended demographics
  sex: string | null;
  blood_group: string | null;
  gender_identity: string | null;
  preferred_pronouns: string | null;

  // Mailing address
  mailing_address_line1: string | null;
  mailing_address_line2: string | null;
  mailing_city: string | null;
  mailing_state: string | null;
  mailing_postal_code: string | null;
  mailing_country: string | null;

  // Physical address
  physical_same_as_mailing: boolean;
  physical_address_line1: string | null;
  physical_address_line2: string | null;
  physical_city: string | null;
  physical_state: string | null;
  physical_postal_code: string | null;
  physical_country: string | null;

  // Emergency contact
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
}

export interface PatientNotificationPrefs {
  appointments: boolean;
  sms: boolean;
  email: boolean;
  labs: boolean;
}

export interface PatientHealthcarePrefs {
  pharmacy: string | null;
  language: string | null;
  comm_channel: string | null;
}

export interface PatientPreferences {
  notifications: PatientNotificationPrefs;
  healthcare: PatientHealthcarePrefs;
}

export interface AIHealthSummary {
  summary: string;
  bullets: string[];
  confidence: number;
  generated_at: string;
}
