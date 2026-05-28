import { api } from "@/lib/api-client";
import { env } from "@/config/env";
import { STORAGE_KEYS } from "@/config/constants";

export interface PatientDocument {
  id: string;
  name: string;
  category: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface PatientDocumentList {
  items: PatientDocument[];
  total: number;
}

export const docsApi = {
  list: (): Promise<PatientDocumentList> =>
    api.get<PatientDocumentList>("/patient-portal/me/documents"),

  downloadUrl: (id: string): string =>
    `${env.API_BASE_URL}/patient-portal/me/documents/${id}/download`,

  open: (id: string): void => {
    const token = localStorage.getItem(STORAGE_KEYS.accessToken);
    if (!token) return;
    fetch(docsApi.downloadUrl(id), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      });
  },
};
