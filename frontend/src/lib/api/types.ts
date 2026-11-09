/** Aliases of the generated NestJS/OpenAPI contracts; no second API schema. */
export type Profile = API.CVResource["profile"];
export type SectionItem = API.CVResource["sections"][number]["items"][number];
export type Section = API.CVResource["sections"][number];
export type StyleSettings = API.CVResource["styleSettings"];
export type CVResource = API.CVResource;
export type CreateCVRequest = API.CreateCVRequest;
export type UpdateCVRequest = API.UpdateCVRequest;
export type ListCVsResponse = API.CvList;
export type ResumeData = API.ResumeDocument;
export type { GoogleApiError } from "./request";
