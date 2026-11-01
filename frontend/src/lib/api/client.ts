/**
 * CVory API Client with Google AIP error handling and etag concurrency support.
 */

import {
  CVResource,
  CreateCVRequest,
  ListCVsResponse,
  UpdateCVRequest,
  ApiErrorResponse,
  GoogleApiError,
} from "./types";

export class ApiError extends Error {
  public code: number;
  public status: GoogleApiError["status"];
  public details: any[];

  constructor(apiError: GoogleApiError) {
    super(apiError.message);
    this.name = "ApiError";
    this.code = apiError.code;
    this.status = apiError.status;
    this.details = apiError.details || [];
  }

  get isConcurrencyConflict(): boolean {
    return this.code === 409 || this.status === "ABORTED";
  }

  get isNotFound(): boolean {
    return this.code === 404 || this.status === "NOT_FOUND";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errBody: ApiErrorResponse | null = null;
    try {
      errBody = await response.json();
    } catch {
      // JSON parse failed
    }

    if (errBody && errBody.error) {
      throw new ApiError(errBody.error);
    }

    throw new ApiError({
      code: response.status,
      message: response.statusText || "网络请求失败",
      status: "INTERNAL",
      details: [],
    });
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const cvApi = {
  /**
   * List all CVs
   */
  async listCvs(pageSize: number = 50, pageToken?: string): Promise<ListCVsResponse> {
    const params = new URLSearchParams({ pageSize: String(pageSize) });
    if (pageToken) params.set("pageToken", pageToken);
    return request<ListCVsResponse>(`/api/v1/cvs?${params.toString()}`);
  },

  /**
   * Get single CV
   */
  async getCv(cvId: string): Promise<CVResource> {
    return request<CVResource>(`/api/v1/cvs/${cvId}`);
  },

  /**
   * Create new CV
   */
  async createCv(data: CreateCVRequest): Promise<CVResource> {
    return request<CVResource>("/api/v1/cvs", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update CV conditionally with etag
   */
  async updateCv(cvId: string, data: UpdateCVRequest, ifMatch?: string): Promise<CVResource> {
    const headers: Record<string, string> = {};
    if (ifMatch) {
      headers["If-Match"] = `"${ifMatch}"`;
    }
    return request<CVResource>(`/api/v1/cvs/${cvId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete CV
   */
  async deleteCv(cvId: string, ifMatch?: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (ifMatch) {
      headers["If-Match"] = `"${ifMatch}"`;
    }
    await request<void>(`/api/v1/cvs/${cvId}`, {
      method: "DELETE",
      headers,
    });
  },

  /**
   * Upload avatar image
   */
  async uploadAvatar(cvId: string, file: File): Promise<CVResource> {
    const formData = new FormData();
    formData.append("file", file);
    return request<CVResource>(`/api/v1/cvs/${cvId}/avatar`, {
      method: "POST",
      body: formData,
    });
  },
};
