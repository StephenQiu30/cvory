// @ts-ignore
/* eslint-disable */
import request from "@/lib/api/request";

/** 此处后端没有提供注释 GET /api/account/github/authorize */
export async function authorizeGithub(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.authorizeGithubParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/account/github/authorize", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/account/github/callback */
export async function completeGithub(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.completeGithubParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/account/github/callback", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/account/github/connection */
export async function getGithubConnection(options?: { [key: string]: any }) {
  return request<API.GithubConnection>("/api/account/github/connection", {
    method: "GET",
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/account/github/link */
export async function linkGithub(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.linkGithubParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/account/github/link", {
    method: "POST",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/account/github/repositories */
export async function listGithubRepositories(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listGithubRepositoriesParams,
  options?: { [key: string]: any }
) {
  return request<API.GithubRepositories>("/api/account/github/repositories", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
