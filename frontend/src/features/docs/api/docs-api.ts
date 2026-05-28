import { api, ApiError } from "@/lib/api-client";
import { stripUndefined } from "@/lib/api-utils";
import { env } from "@/config/env";
import { STORAGE_KEYS } from "@/config/constants";

export type DocCategory =
  | "consent"
  | "lab"
  | "imaging"
  | "discharge"
  | "referral"
  | "insurance"
  | "operative"
  | "pathology"
  | "education"
  | "advance_directive"
  | "other";

export interface Document {
  id: string;
  patientId: string;
  patientName: string | null;
  patientMrn: string | null;
  name: string;
  category: string;
  mimeType: string;
  sizeBytes: number;
  summary: string | null;
  uploadedBy: string | null;
  hasPreview: boolean;
  createdAt: string;
}

interface BackendDocumentDto {
  id: string;
  patient_id: string;
  patient_name?: string | null;
  patient_mrn?: string | null;
  name: string;
  category: string;
  mime_type: string;
  size_bytes: number;
  summary?: string | null;
  uploaded_by?: string | null;
  has_preview?: boolean;
  created_at: string;
}

interface BackendPage<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface DocumentPage {
  items: Document[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface DocumentFilters {
  q?: string;
  patient_id?: string;
  category?: DocCategory;
  uploaded_by?: string;
  /** Filter by upload source: "patient" returns client-uploaded
   *  documents only; "staff" returns everything else. */
  source?: "patient" | "staff";
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export interface DocumentPreviewBody {
  id: string;
  name: string;
  mimeType: string;
  text: string;
}

function mapDocument(dto: BackendDocumentDto): Document {
  return {
    id: dto.id,
    patientId: dto.patient_id,
    patientName: dto.patient_name ?? null,
    patientMrn: dto.patient_mrn ?? null,
    name: dto.name,
    category: dto.category,
    mimeType: dto.mime_type,
    sizeBytes: dto.size_bytes,
    summary: dto.summary ?? null,
    uploadedBy: dto.uploaded_by ?? null,
    hasPreview: dto.has_preview ?? false,
    createdAt: dto.created_at,
  };
}

export const docsApi = {
  list: async (filters: DocumentFilters): Promise<DocumentPage> => {
    const data = await api.get<BackendPage<BackendDocumentDto>>("/documents", {
      searchParams: stripUndefined(filters) as Record<string, string | number>,
    });
    return {
      items: data.items.map(mapDocument),
      total: data.total,
      page: data.page,
      page_size: data.page_size,
      pages: data.pages,
    };
  },

  forPatient: async (patientId: string): Promise<Document[]> => {
    const data = await api.get<BackendDocumentDto[]>(
      `/documents/patient/${patientId}`
    );
    return data.map(mapDocument);
  },

  get: async (id: string): Promise<Document> => {
    const dto = await api.get<BackendDocumentDto>(`/documents/${id}`);
    return mapDocument(dto);
  },

  preview: async (id: string): Promise<DocumentPreviewBody> => {
    const dto = await api.get<{
      id: string;
      name: string;
      mime_type: string;
      text: string;
    }>(`/documents/${id}/preview`);
    return {
      id: dto.id,
      name: dto.name,
      mimeType: dto.mime_type,
      text: dto.text,
    };
  },

  remove: (id: string): Promise<void> => api.delete(`/documents/${id}`),

  /**
   * Multipart upload — the api-client wrapper doesn't handle FormData,
   * so we hit fetch directly and respect the same auth + error flow.
   */
  upload: async (input: {
    patientId: string;
    category: DocCategory;
    file: File;
  }): Promise<Document> => {
    const form = new FormData();
    form.append("patient_id", input.patientId);
    form.append("category", input.category);
    form.append("file", input.file);

    const token = localStorage.getItem(STORAGE_KEYS.accessToken);
    const res = await fetch(`${env.API_BASE_URL}/documents/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    if (!res.ok) {
      let detail = res.statusText || "Upload failed";
      try {
        const json = await res.json();
        if (json?.detail) detail = String(json.detail);
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, detail);
    }
    const payload = (await res.json()) as {
      document: BackendDocumentDto;
      chunks_indexed: number;
    };
    return mapDocument(payload.document);
  },

  /**
   * Fetch the document's bytes with auth and return an object URL.
   * Callers must revoke the URL when the preview unmounts.
   */
  fetchBlobUrl: async (id: string): Promise<string> => {
    const token = localStorage.getItem(STORAGE_KEYS.accessToken);
    const res = await fetch(`${env.API_BASE_URL}/documents/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      let detail = res.statusText || "Preview failed";
      try {
        const json = await res.json();
        if (json?.detail) detail = String(json.detail);
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, detail);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  /**
   * Authenticated blob download. Fetches the binary, drops it through
   * a hidden anchor so the browser saves with the original name.
   */
  download: async (doc: Document): Promise<void> => {
    const token = localStorage.getItem(STORAGE_KEYS.accessToken);
    const res = await fetch(
      `${env.API_BASE_URL}/documents/${doc.id}/download`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    );
    if (!res.ok) {
      let detail = res.statusText || "Download failed";
      try {
        const json = await res.json();
        if (json?.detail) detail = String(json.detail);
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, detail);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = doc.name;
    window.document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
