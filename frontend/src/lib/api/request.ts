import axios, { type AxiosRequestConfig } from "axios";
export interface GoogleApiError {
  code: number;
  message: string;
  status: string;
  details?: Array<{
    "@type": string;
    fieldViolations?: Array<{ field: string; description: string }>;
    reason?: string;
    domain?: string;
    [key: string]: unknown;
  }>;
}
export class ApiError extends Error {
  code: number;
  status: string;
  details: NonNullable<GoogleApiError["details"]>;
  constructor(error: GoogleApiError) {
    super(error.message);
    this.name = "ApiError";
    this.code = error.code;
    this.status = error.status;
    this.details = error.details ?? [];
  }
  get isConcurrencyConflict() {
    return this.code === 409 || this.status === "ABORTED";
  }
  get isNotFound() {
    return this.code === 404;
  }
}
const client = axios.create({
  timeout: 15000,
  headers: { "X-Requested-With": "XMLHttpRequest" },
});
export type RequestOptions = AxiosRequestConfig & {
  requestType?: "form" | "json";
  returnResponse?: boolean;
};
export default async function request<T = unknown>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  try {
    const { requestType, returnResponse, ...config } = options;
    if (
      requestType === "form" &&
      config.data &&
      !(config.data instanceof FormData)
    ) {
      const form = new FormData();
      for (const [key, value] of Object.entries(config.data))
        form.append(key, value as Blob);
      config.data = form;
    }
    const response = await client.request<T>({ url, ...config });
    return (returnResponse ? response : response.data) as T;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      let data: unknown = error.response?.data;
      if (data instanceof Blob) {
        try {
          data = JSON.parse(await data.text());
        } catch {
          data = undefined;
        }
      }
      if (data && typeof data === "object" && "error" in data) {
        const e = data.error;
        if (
          e &&
          typeof e === "object" &&
          "code" in e &&
          typeof e.code === "number" &&
          "message" in e &&
          typeof e.message === "string" &&
          "status" in e &&
          typeof e.status === "string"
        )
          throw new ApiError(e as GoogleApiError);
      }
      throw new ApiError({
        code: error.response?.status ?? 503,
        message: "Unable to complete the request.",
        status: "UNAVAILABLE",
      });
    }
    throw error;
  }
}
