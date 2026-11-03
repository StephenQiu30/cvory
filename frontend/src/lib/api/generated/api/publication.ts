// @ts-ignore
/* eslint-disable */
import request from "@/lib/api/request";

/** Public Resume GET /api/public/${param0} */
export async function getPublicResume(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPublicResumeParams,
  options?: { [key: string]: any }
) {
  const { public_id: param0, ...queryParams } = params;
  return request<API.ResumeDocument>(`/api/public/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** Status GET /api/publication */
export async function getPublication(options?: { [key: string]: any }) {
  return request<API.PublicationStatus>("/api/publication", {
    method: "GET",
    ...(options || {}),
  });
}

/** Withdraw DELETE /api/publication */
export async function withdrawPublication(options?: { [key: string]: any }) {
  return request<any>("/api/publication", {
    method: "DELETE",
    ...(options || {}),
  });
}

/** Preview POST /api/publication%3Apreview */
export async function previewPublication(
  body: API.PublicSelection,
  options?: { [key: string]: any }
) {
  return request<API.PublicationReview>("/api/publication%3Apreview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** Publish POST /api/publication%3Apublish */
export async function publishPublication(
  body: API.PublishRequest,
  options?: { [key: string]: any }
) {
  return request<API.PublicationStatus>("/api/publication%3Apublish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}
