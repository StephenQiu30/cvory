import { ApiError } from "./request";

/** Translate stable API status codes; never expose server messages or parse English text. */
export function errorMessage(
  error: unknown,
  fallback: string,
  unauthenticated = "登录已过期，请重新登录后重试。当前输入已保留。",
) {
  if (!(error instanceof ApiError)) return fallback;
  if (error.details.some((detail) => detail.reason === "ACCOUNT_CHANGED"))
    return "账户已切换，输入仍保留在原账户，请重新登录原账户后重试。";
  if (error.code === 401) return unauthenticated;
  if (error.code === 403)
    return "当前账户无法执行此操作，请确认权限和邮箱验证状态。";
  if (error.code === 429) return "操作过于频繁，请稍后重试。";
  if (error.code >= 500)
    return "暂时无法连接服务，请稍后重试。当前输入已保留。";
  return fallback;
}
