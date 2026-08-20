import type { MicroCompetencyTag } from "@dentsocia/shared-constants";
import { apiClient } from "./authApi";

export type CaseStage = "before" | "during" | "after";

export interface CaseImageInput {
  storageKey: string;
  stage: CaseStage;
}

export interface CaseImage {
  stage: CaseStage;
  url: string;
}

export interface CaseAuthor {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CaseItem {
  id: string;
  title: string;
  description: string;
  specialties: MicroCompetencyTag[];
  images: CaseImage[];
  author: CaseAuthor;
  createdAt: string;
}

export interface CreateCaseInput {
  title: string;
  description?: string;
  specialties?: MicroCompetencyTag[];
  images: CaseImageInput[];
}

export interface FeedPage {
  cases: CaseItem[];
  nextCursor: string | null;
}

export async function requestImageUploadUrl(
  contentType: "image/jpeg" | "image/png",
): Promise<{ uploadUrl: string; storageKey: string }> {
  const { data } = await apiClient.post<{ uploadUrl: string; storageKey: string }>("/api/v1/cases/image-upload-url", {
    contentType,
  });
  return data;
}

export async function createCase(input: CreateCaseInput): Promise<CaseItem> {
  const { data } = await apiClient.post<CaseItem>("/api/v1/cases", input);
  return data;
}

export async function getFeed(cursor?: string): Promise<FeedPage> {
  const { data } = await apiClient.get<FeedPage>("/api/v1/cases", { params: cursor ? { cursor } : undefined });
  return data;
}

export interface CaseDraft {
  title: string;
  description: string;
  specialties: MicroCompetencyTag[];
}

export async function generateCaseDraft(input: {
  storageKeys: string[];
  captionText?: string;
}): Promise<CaseDraft> {
  const { data } = await apiClient.post<CaseDraft>("/api/v1/cases/ai-draft", input);
  return data;
}
