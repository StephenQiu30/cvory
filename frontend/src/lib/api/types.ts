/**
 * CVory API TypeScript contracts matching backend Pydantic schemas.
 */

export interface Profile {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  avatarUrl: string | null;
}

export interface SectionItem {
  id: string;
  title: string;
  subtitle: string;
  dateRange: string;
  location: string;
  description: any; // Tiptap JSON document or plain text
  tags: string[];
}

export interface Section {
  id: string;
  type: "summary" | "experience" | "education" | "project" | "skill" | "custom";
  title: string;
  visible: boolean;
  content: any; // for summary or direct rich text
  items: SectionItem[];
}

export interface StyleSettings {
  templateId: "standard" | "compact";
  fontSize: number;
  lineHeight: number;
  margin: number;
}

export interface CVResource {
  name: string; // "cvs/{id}"
  id: string;
  displayName: string;
  etag: string;
  profile: Profile;
  sections: Section[];
  styleSettings: StyleSettings;
  createTime: string;
  updateTime: string;
}

export interface CreateCVRequest {
  displayName: string;
  profile?: Partial<Profile>;
  sections?: Section[];
  styleSettings?: Partial<StyleSettings>;
}

export interface UpdateCVRequest {
  displayName?: string;
  profile?: Profile;
  sections?: Section[];
  styleSettings?: StyleSettings;
  etag?: string;
  updateMask?: string;
}

export interface ListCVsResponse {
  cvs: CVResource[];
  nextPageToken: string;
  totalSize: number;
}

import type { GoogleApiError } from "./request";

export type { GoogleApiError };

export interface ApiErrorResponse {
  error: GoogleApiError;
}
