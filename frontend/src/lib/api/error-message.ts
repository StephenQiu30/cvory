import { ApiError } from "./request";

/** Translate stable API status codes; never expose server messages or parse English text. */
export function errorMessage(
  error: unknown,
  fallback: string,
  unauthenticated = "登录已过期，请重新登录后重试。当前输入已保留。",
) {
  if (!(error instanceof ApiError)) return fallback;
  const reason = error.details.find((detail) => detail.reason)?.reason;
  if (reason === "GITHUB_REPOSITORY_NOT_AVAILABLE")
    return "所选 GitHub 项目已删除、设为私有或不再属于当前账户。请在 GitHub 项目设置中移除后重新预览。";
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
  if (reason === "PDF_BUSY") return "PDF/PNG 导出任务较多，请稍后重试。";
  if (reason === "PDF_TIMEOUT")
    return "PDF 页面生成超时，临时浏览器资源已清理。请重试或导出 JSON 备份。";
  if (reason === "PDF_UNAVAILABLE")
    return "PDF 页面或字体、照片资源暂时无法渲染。请核对简历资源后重试，已保存内容不受影响。";
  if (reason === "PNG_LIMIT_EXCEEDED")
    return "简历超过 PNG 导出限制：最多 30 页、单页边长 4,096 px、总像素 64,000,000、输出 50 MiB。可先减少内容后重试，已保存内容不受影响。";
  if (reason === "PNG_PROCESSOR_BUSY") return "图片导出任务较多，请稍后重试。";
  if (reason === "PNG_TIMEOUT")
    return "PNG 导出超时，临时渲染资源已清理。请稍后重试或下载 PDF。";
  if (reason === "PNG_UNAVAILABLE")
    return "PNG 渲染暂时不可用。请稍后重试或下载 PDF，已保存内容不受影响。";
  if (reason === "AI_ENCRYPTION_KEY_REQUIRED")
    return "AI 设置尚不可用，请联系站点部署者配置 AI_ENCRYPTION_KEY。";
  if (reason === "AI_PROVIDER_KEY_REQUIRED")
    return "首次配置此服务时需要填写 API Key。";
  if (reason === "AI_PROVIDER_NOT_CONFIGURED")
    return "请先在 AI 服务设置中填写 API Key 和模型 ID。";
  if (reason === "AI_PROVIDER_CONFIGURATION_CHANGED")
    return "服务配置在预览后已变化，请重新检查模型和发送内容。";
  if (reason === "AI_PROVIDER_AUTH_FAILED")
    return "服务商未接受此 API Key，请检查密钥后重试。";
  if (reason === "AI_PROVIDER_RATE_LIMITED")
    return "服务商暂时限流，请稍后重试；CVory 不会自动重复请求。";
  if (reason === "AI_PROVIDER_REQUEST_REJECTED")
    return "服务商拒绝了请求，请核对模型 ID 和该模型的 API 支持。";
  if (reason === "AI_PROVIDER_UNAVAILABLE")
    return "服务商暂时不可用，请稍后再试。";
  if (reason === "AI_PROVIDER_KEY_UNAVAILABLE")
    return "已保存的 API Key 无法解密。请部署者恢复原 AI_ENCRYPTION_KEY；不要覆盖原密文配置。";
  if (reason === "AI_RESULT_UNKNOWN")
    return "未能确认服务商是否已完成请求，费用可能已产生。CVory 不会自动重试；请先查看 7 天内的分析记录。";
  if (reason === "AI_RESPONSE_INVALID")
    return "模型返回的结果缺少可核验依据或格式不完整，未生成可采纳建议。";
  if (reason === "AI_REQUEST_ALREADY_USED")
    return "此请求已提交过，请在最近分析记录中查看结果；不要重复发送。";
  if (reason === "AI_TARGET_FIELD_CHANGED")
    return "目标字段已变化，请重新选择字段并生成新的输入预览。";
  if (reason === "AI_REPORT_UNAVAILABLE")
    return "分析记录无法解密或读取。请检查部署者是否保留原 AI_ENCRYPTION_KEY。";
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
