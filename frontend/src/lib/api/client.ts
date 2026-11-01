/**
 * CVory API Client utilizing @umijs/openapi generated methods and Axios.
 */

import * as generated from "./generated/api/cvs";
import {
  CVResource,
  CreateCVRequest,
  ListCVsResponse,
  UpdateCVRequest,
} from "./types";
import { ApiError, GoogleApiError } from "./request";

export { ApiError, type GoogleApiError };

export const cvApi = {
  /**
   * List all CVs
   */
  async listCvs(pageSize: number = 50, pageToken?: string): Promise<ListCVsResponse> {
    const res = await generated.listCvs({
      pageSize: String(pageSize) as any,
      pageToken,
    });
    return res as unknown as ListCVsResponse;
  },

  /**
   * Get single CV
   */
  async getCv(cvId: string): Promise<CVResource> {
    const res = await generated.getCv({ cv_id: cvId });
    return res as unknown as CVResource;
  },

  /**
   * Create new CV
   */
  async createCv(data: CreateCVRequest): Promise<CVResource> {
    const res = await generated.createCv(data as any);
    return res as unknown as CVResource;
  },

  /**
   * Update CV conditionally with etag
   */
  async updateCv(cvId: string, data: UpdateCVRequest, ifMatch?: string): Promise<CVResource> {
    const headers: Record<string, string> = {};
    if (ifMatch) {
      headers["If-Match"] = `"${ifMatch}"`;
    }
    const res = await generated.updateCv(
      { cv_id: cvId },
      data as any,
      { headers }
    );
    return res as unknown as CVResource;
  },

  /**
   * Delete CV
   */
  async deleteCv(cvId: string, ifMatch?: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (ifMatch) {
      headers["If-Match"] = `"${ifMatch}"`;
    }
    await generated.deleteCv({ cv_id: cvId }, { headers });
  },

  /**
   * Upload avatar image
   */
  async uploadAvatar(cvId: string, file: File): Promise<CVResource> {
    const res = await generated.uploadCvAvatar(
      { cv_id: cvId },
      { file: file as any }
    );
    return res as unknown as CVResource;
  },
};
