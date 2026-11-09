// @ts-ignore
/* eslint-disable */
import request from "@/lib/api/request";

/** 此处后端没有提供注释 GET /api/cvs */
export async function listCvs(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCvsParams,
  options?: { [key: string]: any }
) {
  return request<API.CvList>("/api/cvs", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/cvs */
export async function createCv(
  body: API.CreateCVRequest,
  options?: { [key: string]: any }
) {
  return request<API.CVResource>("/api/cvs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/cvs/${param0} */
export async function getCv(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCvParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.CVResource>(`/api/cvs/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/cvs/${param0} */
export async function deleteCv(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCvParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/cvs/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PATCH /api/cvs/${param0} */
export async function updateCv(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCvParams,
  body: API.UpdateCVRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.CVResource>(`/api/cvs/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/cvs/${param0}/revisions */
export async function listCvRevisions(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCvRevisionsParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.CvHistory>(`/api/cvs/${param0}/revisions`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/cvs/${param0}/revisions/${param1}%3Arestore */
export async function restoreCvRevision(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.restoreCvRevisionParams,
  body: API.RestoreRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, revision: param1, ...queryParams } = params;
  return request<API.CVResource>(
    `/api/cvs/${param0}/revisions/${param1}%3Arestore`,
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

/** 此处后端没有提供注释 POST /api/cvs/${param0}%3Acopy */
export async function copyCv(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.copyCvParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.CVResource>(`/api/cvs/${param0}%3Acopy`, {
    method: "POST",
    params: { ...queryParams },
    ...(options || {}),
  });
}
