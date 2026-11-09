// @ts-ignore
/* eslint-disable */
import request from "@/lib/api/request";

/** 此处后端没有提供注释 GET /api/cvs/${param0}/avatar */
export async function getCvAvatar(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCvAvatarParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<string>(`/api/cvs/${param0}/avatar`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/cvs/${param0}/avatar */
export async function uploadCvAvatar(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.uploadCvAvatarParams,
  body: {},
  file?: File,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  const formData = new FormData();

  if (file) {
    formData.append("file", file);
  }

  Object.keys(body).forEach((ele) => {
    const item = (body as any)[ele];

    if (item !== undefined && item !== null) {
      if (typeof item === "object" && !(item instanceof File)) {
        if (item instanceof Array) {
          item.forEach((f) => formData.append(ele, f || ""));
        } else {
          formData.append(
            ele,
            new Blob([JSON.stringify(item)], { type: "application/json" })
          );
        }
      } else {
        formData.append(ele, item);
      }
    }
  });

  return request<API.CVResource>(`/api/cvs/${param0}/avatar`, {
    method: "POST",
    params: { ...queryParams },
    data: formData,
    requestType: "form",
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/cvs/${param0}/pdf */
export async function exportCvPdf(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.exportCvPdfParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<string>(`/api/cvs/${param0}/pdf`, {
    method: "GET",
    params: {
      ...queryParams,
    },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/print/${param0} */
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
