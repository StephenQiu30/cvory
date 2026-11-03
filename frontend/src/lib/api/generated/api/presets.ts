// @ts-ignore
/* eslint-disable */
import request from "@/lib/api/request";

/** List Presets GET /api/presets */
export async function listPresets(options?: { [key: string]: any }) {
  return request<API.StylePreset[]>("/api/presets", {
    method: "GET",
    ...(options || {}),
  });
}

/** Save Preset POST /api/presets */
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

/** Delete Preset DELETE /api/presets/${param0} */
export async function deletePreset(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deletePresetParams,
  options?: { [key: string]: any }
) {
  const { preset_id: param0, ...queryParams } = params;
  return request<any>(`/api/presets/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}
