import * as generated from "./generated/api/cvs";
import type { CreateCVRequest, UpdateCVRequest } from "./types";
export { ApiError, type GoogleApiError } from "./request";
export const cvApi = {
  listCvs: (pageSize = 50, pageToken?: string) =>
    generated.listCvs({ pageSize, pageToken }),
  getCv: (id: string) => generated.getCv({ id }),
  createCv: (data: CreateCVRequest, expectedOwner?: string) =>
    generated.createCv(
      data,
      expectedOwner
        ? {
            headers: {
              "Content-Type": "application/json",
              "X-Cvory-Owner": expectedOwner,
            },
          }
        : undefined,
    ),
  updateCv: (id: string, data: UpdateCVRequest, etag?: string) =>
    generated.updateCv({ id }, data, {
      headers: etag ? { "If-Match": `"${etag}"` } : {},
    }),
  deleteCv: (id: string, etag?: string) =>
    generated.deleteCv(
      { id },
      { headers: etag ? { "If-Match": `"${etag}"` } : {} },
    ),
};
