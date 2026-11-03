import * as generated from "./generated/api/cvs";
import type { CreateCVRequest, UpdateCVRequest } from "./types";
export { ApiError, type GoogleApiError } from "./request";
export const cvApi = {
  listCvs: (pageSize = 50, pageToken?: string) =>
    generated.listCvs({ pageSize, pageToken }),
  getCv: (id: string) => generated.getCv({ cv_id: id }),
  createCv: (data: CreateCVRequest) => generated.createCv(data),
  updateCv: (id: string, data: UpdateCVRequest, etag?: string) =>
    generated.updateCv({ cv_id: id }, data, {
      headers: etag ? { "If-Match": `"${etag}"` } : {},
    }),
  deleteCv: (id: string, etag?: string) =>
    generated.deleteCv(
      { cv_id: id },
      { headers: etag ? { "If-Match": `"${etag}"` } : {} },
    ),
};
