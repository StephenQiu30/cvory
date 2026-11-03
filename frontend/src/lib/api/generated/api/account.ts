// @ts-ignore
/* eslint-disable */
import request from "@/lib/api/request";

/** Get Account GET /api/account */
export async function getAccount(options?: { [key: string]: any }) {
  return request<API.AccountResource>("/api/account", {
    method: "GET",
    ...(options || {}),
  });
}

/** Update Account PATCH /api/account */
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

/** Login POST /api/account%3Alogin */
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

/** Logout POST /api/account%3Alogout */
export async function logoutAccount(options?: { [key: string]: any }) {
  return request<any>("/api/account%3Alogout", {
    method: "POST",
    ...(options || {}),
  });
}

/** Register POST /api/account%3Aregister */
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
