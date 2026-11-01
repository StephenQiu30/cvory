// @ts-ignore
/* eslint-disable */
import request from "@/lib/api/request";

/** 系统健康检查探针 用于容器存活与就绪探针检查服务状态。 GET /healthz */
export async function healthCheckHealthzGet(options?: { [key: string]: any }) {
  return request<any>("/healthz", {
    method: "GET",
    ...(options || {}),
  });
}
