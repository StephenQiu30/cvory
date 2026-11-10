import * as generated from "./generated/api/cvs";
import * as filesGenerated from "./generated/api/files";
import * as aiGenerated from "./generated/api/ai";
import type { CreateCVRequest, UpdateCVRequest } from "./types";
export { ApiError, type GoogleApiError } from "./request";
export const cvApi = {
  listCvs: (pageSize = 50, pageToken?: string) =>
    generated.listCvs({ pageSize, pageToken }),
  getCv: (id: string) => generated.getCv({ id }),
  listRevisions: (id: string) => generated.listCvRevisions({ id }),
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
export const fileApi = {
  parseResumeImport: (file: File, signal: AbortSignal) =>
    filesGenerated.parseResumeImport({}, file, { signal, timeout: 30000 }),
};
export const aiApi = {
  listProviders: () => aiGenerated.listAiProviders(),
  updateProvider: (
    provider: API.AiProviderStatus["provider"],
    data: API.UpdateAiProviderRequest,
  ) => aiGenerated.updateAiProvider({ provider }, data),
  deleteProvider: (provider: API.AiProviderStatus["provider"]) =>
    aiGenerated.deleteAiProvider({ provider }),
  testProvider: (
    provider: API.AiProviderStatus["provider"],
    requestId: string,
    signal?: AbortSignal,
  ) =>
    aiGenerated.testAiProvider(
      { provider },
      { requestId },
      { signal, timeout: 125000 },
    ),
  preview: (data: API.PreviewCvRequest) => aiGenerated.previewCvAnalysis(data),
  analyze: (data: API.AnalyzeCvRequest, signal?: AbortSignal) =>
    aiGenerated.analyzeCv(data, { signal, timeout: 125000 }),
  listReports: (pageSize = 20, pageToken?: string) =>
    aiGenerated.listAiReports({ pageSize, pageToken }),
  getReport: (id: string) => aiGenerated.getAiReport({ id }),
};
