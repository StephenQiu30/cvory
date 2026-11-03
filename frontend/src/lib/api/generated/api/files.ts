// @ts-ignore
/* eslint-disable */
import request from "@/lib/api/request";

/** Pdf GET /api/cvs/${param0}/pdf */
export async function exportCvPdf(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.exportCvPdfParams,
  options?: { [key: string]: any }
) {
  const { cv_id: param0, ...queryParams } = params;
  return request<any>(`/api/cvs/${param0}/pdf`, {
    method: "GET",
    params: {
      ...queryParams,
    },
    ...(options || {}),
  });
}

/** Print Context GET /api/print/${param0} */
export async function getPrintContext(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPrintContextParams,
  options?: { [key: string]: any }
) {
  const { ticket: param0, ...queryParams } = params;
  return request<API.ResumeDocument>(`/api/print/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}
