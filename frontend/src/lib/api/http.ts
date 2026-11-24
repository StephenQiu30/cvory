import axios, { type AxiosRequestConfig } from "axios";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001/api";

export const httpClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
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
