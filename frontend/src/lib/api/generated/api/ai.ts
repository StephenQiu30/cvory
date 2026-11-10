// @ts-ignore
/* eslint-disable */
import request from "@/lib/api/request";

/** 此处后端没有提供注释 GET /api/ai/providers */
export async function listAiProviders(options?: { [key: string]: any }) {
  return request<API.AiProviderList>("/api/ai/providers", {
    method: "GET",
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/ai/providers/${param0} */
export async function deleteAiProvider(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteAiProviderParams,
  options?: { [key: string]: any }
) {
  const { provider: param0, ...queryParams } = params;
  return request<any>(`/api/ai/providers/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PATCH /api/ai/providers/${param0} */
export async function updateAiProvider(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateAiProviderParams,
  body: API.UpdateAiProviderRequest,
  options?: { [key: string]: any }
) {
  const { provider: param0, ...queryParams } = params;
  return request<API.AiProviderList>(`/api/ai/providers/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/ai/providers/${param0}%3Atest */
export async function testAiProvider(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.testAiProviderParams,
  body: API.AiConnectionTestRequest,
  options?: { [key: string]: any }
) {
  const { provider: param0, ...queryParams } = params;
  return request<API.AiConnectionTestResult>(
    `/api/ai/providers/${param0}%3Atest`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 此处后端没有提供注释 GET /api/ai/reports */
export async function listAiReports(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listAiReportsParams,
  options?: { [key: string]: any }
) {
  return request<API.AiReportList>("/api/ai/reports", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/ai/reports/${param0} */
export async function getAiReport(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getAiReportParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.AiReportResource>(`/api/ai/reports/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/ai%3Aanalyze */
export async function analyzeCv(
  body: API.AnalyzeCvRequest,
  options?: { [key: string]: any }
) {
  return request<API.AiReportResource>("/api/ai%3Aanalyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/ai%3Apreview */
export async function previewCvAnalysis(
  body: API.PreviewCvRequest,
  options?: { [key: string]: any }
) {
  return request<API.AiAnalysisPreview>("/api/ai%3Apreview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}
