import axios, { AxiosError, AxiosRequestConfig } from "axios";

export interface GoogleApiError {
  code: number;
  message: string;
  status: "INVALID_ARGUMENT" | "UNAUTHENTICATED" | "PERMISSION_DENIED" | "NOT_FOUND" | "ABORTED" | "INTERNAL";
  details?: Array<{
    "@type": string;
    fieldViolations?: Array<{ field: string; description: string }>;
    reason?: string;
    domain?: string;
    [key: string]: any;
  }>;
}

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

const axiosInstance = axios.create({
  timeout: 15000,
  headers: {
    "X-Requested-With": "XMLHttpRequest",
  },
});

export interface RequestOptions extends AxiosRequestConfig {
  data?: any;
  params?: any;
  [key: string]: any;
}

/**
 * Standard request function compatible with @umijs/openapi generated code, backed by Axios.
 */
export default async function request<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", data, params, headers, ...rest } = options;

  try {
    const response = await axiosInstance.request<T>({
      url,
      method: method as any,
      data,
      params,
      headers,
      ...rest,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosErr = error as AxiosError<{ error?: GoogleApiError }>;
      const responseData = axiosErr.response?.data;

      if (responseData && responseData.error) {
        throw new ApiError(responseData.error);
      }

      throw new ApiError({
        code: axiosErr.response?.status || 500,
        message: axiosErr.message || "网络请求异常",
        status: "INTERNAL",
        details: [],
      });
    }

    throw new ApiError({
      code: 500,
      message: (error as Error)?.message || "未知请求错误",
      status: "INTERNAL",
      details: [],
    });
  }
}
