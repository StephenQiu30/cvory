// @ts-ignore
/* eslint-disable */
import request from "@/lib/api/request";

/** 此处后端没有提供注释 GET /api/delivery/jobs */
export async function listDeliveryJobs(options?: { [key: string]: any }) {
  return request<API.DeliveryJobList>("/api/delivery/jobs", {
    method: "GET",
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/delivery/jobs */
export async function createDeliveryJob(
  body: API.CreateDeliveryJobRequest,
  options?: { [key: string]: any }
) {
  return request<API.DeliveryJobResource>("/api/delivery/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/delivery/jobs/${param0} */
export async function deleteDeliveryJob(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteDeliveryJobParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/delivery/jobs/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/delivery/preferences */
export async function getDeliveryPreferences(options?: { [key: string]: any }) {
  return request<API.DeliveryPreferencesResource>("/api/delivery/preferences", {
    method: "GET",
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PATCH /api/delivery/preferences */
export async function updateDeliveryPreferences(
  body: API.DeliveryPreferencesRequest,
  options?: { [key: string]: any }
) {
  return request<API.DeliveryPreferencesResource>("/api/delivery/preferences", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/delivery/tasks */
export async function listDeliveryTasks(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listDeliveryTasksParams,
  options?: { [key: string]: any }
) {
  return request<API.DeliveryTaskList>("/api/delivery/tasks", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/delivery/tasks */
export async function createDeliveryTask(
  body: API.CreateDeliveryTaskRequest,
  options?: { [key: string]: any }
) {
  return request<API.DeliveryTaskResource>("/api/delivery/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/delivery/tasks/${param0} */
export async function getDeliveryTask(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getDeliveryTaskParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.DeliveryTaskResource>(`/api/delivery/tasks/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/delivery/tasks/${param0} */
export async function deleteDeliveryTask(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteDeliveryTaskParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/delivery/tasks/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/delivery/tasks/${param0}%3Asimulate */
export async function simulateDeliveryTask(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.simulateDeliveryTaskParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.DeliveryTaskResource>(
    `/api/delivery/tasks/${param0}%3Asimulate`,
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
