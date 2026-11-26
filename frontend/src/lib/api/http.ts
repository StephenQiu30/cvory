import axios, { type AxiosRequestConfig } from "axios";
import type {
  LocalResumeDocument,
  ResumeContent,
  SupportedTemplateId,
} from "@/lib/contract/contract";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001/api";
const AUTH_STORAGE_KEY = "cvory:v1:auth";

export interface AuthSession {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly user: {
    readonly id: string;
    readonly email: string;
  };
}

export function getStoredAuthSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setStoredAuthSession(session: AuthSession | null): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } else {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  }
}

export const httpClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30_000,
});

httpClient.interceptors.request.use((config) => {
  const session = getStoredAuthSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

/**
 * Adapter used by @umijs/openapi generated service clients.
 */
export async function httpRequest<TResponse>(
  url: string,
  config?: AxiosRequestConfig
): Promise<TResponse> {
  const response = await httpClient.request<TResponse>({
    url,
    ...config,
  });
  return response.data;
}

export interface RemoteResumeDetail {
  readonly id: string;
  readonly title: string;
  readonly template_id: SupportedTemplateId;
  readonly contract_version: 1;
  readonly version: number;
  readonly share_enabled: boolean;
  readonly share_token: string | null;
  readonly content: ResumeContent;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface PublicSharedResume {
  readonly title: string;
  readonly template_id: SupportedTemplateId;
  readonly contract_version: 1;
  readonly content: ResumeContent;
  readonly updated_at: string;
}

export async function sendOtpEmail(email: string): Promise<{ retry_after_seconds: number }> {
  return httpRequest("/auth/otp/send", { method: "POST", data: { email } });
}

export async function verifyOtpEmail(email: string, code: string): Promise<AuthSession> {
  const res = await httpRequest<AuthSession>("/auth/otp/verify", {
    method: "POST",
    data: { email, code },
  });
  setStoredAuthSession(res);
  return res;
}

export async function logoutAccount(): Promise<void> {
  const session = getStoredAuthSession();
  try {
    if (session?.access_token) {
      await httpRequest("/auth/logout", {
        method: "POST",
        data: { refresh_token: session.refresh_token },
      });
    }
  } finally {
    setStoredAuthSession(null);
  }
}

export async function claimDraftToCloud(
  doc: LocalResumeDocument
): Promise<{ resume: RemoteResumeDetail; already_claimed: boolean }> {
  return httpRequest("/resumes/claim", {
    method: "POST",
    data: {
      client_draft_id: doc.id,
      title: doc.title,
      template_id: doc.template_id,
      contract_version: doc.contract_version,
      content: doc.content,
    },
  });
}

export async function saveCloudResume(
  remoteId: string,
  doc: LocalResumeDocument
): Promise<RemoteResumeDetail> {
  return httpRequest(`/resumes/${remoteId}`, {
    method: "PUT",
    data: {
      title: doc.title,
      template_id: doc.template_id,
      contract_version: doc.contract_version,
      expected_version: doc.version,
      content: doc.content,
    },
  });
}

export async function toggleCloudShare(
  remoteId: string,
  enabled: boolean
): Promise<{ id: string; share_enabled: boolean; share_token: string | null }> {
  return httpRequest(`/resumes/${remoteId}/share`, {
    method: "PATCH",
    data: { enabled },
  });
}

export async function fetchPublicSharedResume(shareToken: string): Promise<PublicSharedResume> {
  return httpRequest(`/share/${shareToken}`, { method: "GET" });
}

export async function uploadAvatarToS3(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  return httpRequest("/uploads/avatar", {
    method: "POST",
    data: formData,
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function downloadSnapshotPdf(doc: LocalResumeDocument): Promise<Blob> {
  const response = await httpClient.post<Blob>(
    "/export/pdf",
    {
      title: doc.title,
      template_id: doc.template_id,
      contract_version: doc.contract_version,
      content: doc.content,
    },
    { responseType: "blob" }
  );
  return response.data;
}
