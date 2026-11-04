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

/** Cancel Deletion POST /api/account%3AcancelDeletion */
export async function cancelAccountDeletion(
  body: API.Credentials,
  options?: { [key: string]: any }
) {
  return request<any>("/api/account%3AcancelDeletion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** Change Password POST /api/account%3AchangePassword */
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
  body: API.RegistrationCredentials,
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

/** Request Deletion POST /api/account%3ArequestDeletion */
export async function requestAccountDeletion(
  body: API.CurrentPasswordRequest,
  options?: { [key: string]: any }
) {
  return request<any>("/api/account%3ArequestDeletion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** Request Email Verification POST /api/account%3ArequestEmailVerification */
export async function requestEmailVerification(options?: {
  [key: string]: any;
}) {
  return request<any>("/api/account%3ArequestEmailVerification", {
    method: "POST",
    ...(options || {}),
  });
}

/** Request Password Reset POST /api/account%3ArequestPasswordReset */
export async function requestPasswordReset(
  body: API.EmailRequest,
  options?: { [key: string]: any }
) {
  return request<any>("/api/account%3ArequestPasswordReset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** Reset Password POST /api/account%3AresetPassword */
export async function resetPassword(
  body: API.ResetPasswordRequest,
  options?: { [key: string]: any }
) {
  return request<any>("/api/account%3AresetPassword", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** Verify Email POST /api/account%3AverifyEmail */
export async function verifyEmail(
  body: API.TokenRequest,
  options?: { [key: string]: any }
) {
  return request<API.AccountResource>("/api/account%3AverifyEmail", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}
