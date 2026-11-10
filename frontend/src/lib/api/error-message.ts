import { ApiError } from "./request";

/** Translate stable API status codes; never expose server messages or parse English text. */
export function errorMessage(
  error: unknown,
  fallback: string,
  unauthenticated = "登录已过期，请重新登录后重试。当前输入已保留。",
) {
  if (!(error instanceof ApiError)) return fallback;
  const reason = error.details.find((detail) => detail.reason)?.reason;
  if (reason === "IMPORT_NO_TEXT_LAYER")
    return "PDF 中没有检测到可选文字，可能是扫描件。首期不支持 OCR；请从原文件导出可选择、可复制文字的 PDF 后重试。";
  if (reason === "IMPORT_ENCRYPTED_FILE")
    return "文件受密码保护，暂时无法读取。请解除密码保护后重新导入。";
  if (reason === "IMPORT_UNSUPPORTED_FORMAT")
    return "仅支持 DOCX 和 PDF 文件；旧版 .doc 文件请先另存为 .docx。";
  if (reason === "IMPORT_INVALID_FILE" || reason === "IMPORT_PARSE_FAILED")
    return "文件已损坏或结构无法读取。请用 Word 重新保存 DOCX，或重新导出 PDF 后重试。";
  if (reason === "IMPORT_FILE_TOO_LARGE")
    return "单个文件不能超过 10 MiB，请选择较小的 DOCX 或 PDF。";
  if (reason === "IMPORT_LIMIT_EXCEEDED")
    return "文件超过解析资源限制。请拆分为较短、内容较少的文件后重试。";
  if (reason === "IMPORT_PROCESSOR_BUSY")
    return "文件解析任务较多，请稍后重试。";
  if (reason === "IMPORT_TIMEOUT")
    return "文件解析超时，临时文件已清理。请稍后重试或拆分文件。";
  if (reason === "IMPORT_FILE_REQUIRED")
    return "请选择一个 DOCX 或 PDF 文件后重试。";
  if (error.code === 413)
    return "上传文件超过 10 MiB，请选择较小的 DOCX 或 PDF。";
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
