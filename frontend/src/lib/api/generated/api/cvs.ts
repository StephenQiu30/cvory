// @ts-ignore
/* eslint-disable */
import request from "@/lib/api/request";

/** 获取简历列表 以分页形式列举当前所有者名下的全部简历文档。遵循 Google AIP-158 分页标准，返回当前页项目和下一页游标 nextPageToken。 GET /api/cvs */
export async function listCvs(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCvsParams,
  options?: { [key: string]: any }
) {
  return request<API.ListCVsResponse>("/api/cvs", {
    method: "GET",
    params: {
      // pageSize has a default value: 50
      pageSize: "50",
      ...params,
    },
    ...(options || {}),
  });
}

/** 新建一份个人简历 创建一个独立可编辑的简历资源。服务端会自动生成唯一 UUID、初始化基础结构，并生成初始 ETag。 POST /api/cvs */
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

/** 获取单个简历详情 根据简历 UUID 获取完整的内容、模块数据及当前版本 ETag。 GET /api/cvs/${param0} */
export async function getCv(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCvParams,
  options?: { [key: string]: any }
) {
  const { cv_id: param0, ...queryParams } = params;
  return request<API.CVResource>(`/api/cvs/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除指定简历 永久移除指定简历及其关联的私有头像资源。支持可选的 `If-Match` 请求头保证并发删除安全。 DELETE /api/cvs/${param0} */
export async function deleteCv(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCvParams,
  options?: { [key: string]: any }
) {
  const { cv_id: param0, ...queryParams } = params;
  return request<any>(`/api/cvs/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 条件局部更新简历内容 更新指定简历的内容。遵循 Google AIP-154 并发校验规则：
 * 必须在请求头 `If-Match` 或请求体内 `etag` 携带修改前持有的版本 ETag。
 * 若远端已更新导致 ETag 不一致，服务返回 `409 ABORTED`，保护用户数据不被静默覆盖。
 * 支持 `updateMask` 字段掩码按需更新特定字段（如 `displayName,profile,sections`）。 PATCH /api/cvs/${param0} */
export async function updateCv(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCvParams,
  body: API.UpdateCVRequest,
  options?: { [key: string]: any }
) {
  const { cv_id: param0, ...queryParams } = params;
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

/** 读取简历头像图片 获取指定简历上传保存的头像原始图片文件。 GET /api/cvs/${param0}/avatar */
export async function getCvAvatar(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCvAvatarParams,
  options?: { [key: string]: any }
) {
  const { cv_id: param0, ...queryParams } = params;
  return request<any>(`/api/cvs/${param0}/avatar`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 上传并绑定简历头像 为简历上传个人照片。图片将转存到服务持久目录，更新简历资料中的 `avatarUrl` 并刷新 ETag。 POST /api/cvs/${param0}/avatar */
export async function uploadCvAvatar(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.uploadCvAvatarParams,
  body: API.BodyUploadCvAvatar,
  options?: { [key: string]: any }
) {
  const { cv_id: param0, ...queryParams } = params;
  const formData = new FormData();

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
