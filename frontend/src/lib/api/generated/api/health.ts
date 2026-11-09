// @ts-ignore
/* eslint-disable */
import request from "@/lib/api/request";

/** 此处后端没有提供注释 GET /api/health */
export async function getHealth(options?: { [key: string]: any }) {
  return request<API.Health>("/api/health", {
    method: "GET",
    ...(options || {}),
  });
}
