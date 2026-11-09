// @ts-ignore
/* eslint-disable */
import request from "@/lib/api/request";

/** 此处后端没有提供注释 GET /api/presets */
export async function listPresets(options?: { [key: string]: any }) {
  return request<API.StylePreset[]>("/api/presets", {
    method: "GET",
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/presets */
export async function savePreset(
  body: API.StylePreset,
  options?: { [key: string]: any }
) {
  return request<API.StylePreset>("/api/presets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/presets/${param0} */
export async function deletePreset(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deletePresetParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/presets/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}
