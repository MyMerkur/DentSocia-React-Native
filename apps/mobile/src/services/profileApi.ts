import type { MicroCompetencyTag } from "@dentsocia/shared-constants";
import { apiClient } from "./authApi";

export interface ExperienceEntry {
  title: string;
  workplace: string;
  startYear: number;
  endYear: number | null;
}

export interface ShowcaseProfile {
  displayName: string;
  title: string;
  bio: string;
  avatarUrl: string | null;
  workplace: string;
  city: string;
  specialties: MicroCompetencyTag[];
  isVerifiedOrg: boolean;
  affiliatedOrg: { id: string; displayName: string } | null;
}

export interface CareerProfile {
  openToWork: boolean;
  hiddenSearch: boolean;
  desiredPositions: MicroCompetencyTag[];
  experienceYears: number | null;
  experience: ExperienceEntry[];
}

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  kycLevel: number;
  showcase: ShowcaseProfile;
  career: CareerProfile;
}

export interface ShowcaseUpdateInput {
  displayName?: string;
  title?: string;
  bio?: string;
  avatarKey?: string;
  workplace?: string;
  city?: string;
  specialties?: MicroCompetencyTag[];
}

export interface CareerUpdateInput {
  openToWork?: boolean;
  hiddenSearch?: boolean;
  desiredPositions?: MicroCompetencyTag[];
  experienceYears?: number;
  experience?: ExperienceEntry[];
}

export async function getMe(): Promise<UserProfile> {
  const { data } = await apiClient.get<UserProfile>("/api/v1/users/me");
  return data;
}

export async function updateShowcase(patch: ShowcaseUpdateInput): Promise<UserProfile> {
  const { data } = await apiClient.patch<UserProfile>("/api/v1/users/me/showcase", patch);
  return data;
}

export async function updateCareer(patch: CareerUpdateInput): Promise<UserProfile> {
  const { data } = await apiClient.patch<UserProfile>("/api/v1/users/me/career", patch);
  return data;
}

export async function requestAvatarUploadUrl(
  contentType: "image/jpeg" | "image/png",
): Promise<{ uploadUrl: string; storageKey: string }> {
  const { data } = await apiClient.post<{ uploadUrl: string; storageKey: string }>(
    "/api/v1/users/me/avatar-upload-url",
    { contentType },
  );
  return data;
}

export async function deleteAccount(): Promise<void> {
  await apiClient.delete("/api/v1/users/me");
}

