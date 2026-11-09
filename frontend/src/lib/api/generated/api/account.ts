// @ts-ignore
/* eslint-disable */
import request from "@/lib/api/request";

/** 此处后端没有提供注释 GET /api/account */
export async function getAccount(options?: { [key: string]: any }) {
  return request<API.AccountResource>("/api/account", {
    method: "GET",
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PATCH /api/account */
export async function updateAccount(
  body: API.AccountUpdate,
  options?: { [key: string]: any }
) {
  return request<API.AccountResource>("/api/account", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/account/auth-options */
export async function getAuthOptions(options?: { [key: string]: any }) {
  return request<API.AuthOptions>("/api/account/auth-options", {
    method: "GET",
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/account%3AchangePassword */
export async function changeAccountPassword(
  body: API.ChangePasswordRequest,
  options?: { [key: string]: any }
) {
  return request<API.AccountResource>("/api/account%3AchangePassword", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/account%3Alogin */
export async function loginAccount(
  body: API.Credentials,
  options?: { [key: string]: any }
) {
  return request<API.AccountResource>("/api/account%3Alogin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/account%3Alogout */
export async function logoutAccount(options?: { [key: string]: any }) {
  return request<any>("/api/account%3Alogout", {
    method: "POST",
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/account%3Aregister */
export async function registerAccount(
  body: API.Credentials,
  options?: { [key: string]: any }
) {
  return request<API.AccountResource>("/api/account%3Aregister", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}
