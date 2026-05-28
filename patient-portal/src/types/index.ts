export interface PatientMe {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
}
