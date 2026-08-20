import type { MicroCompetencyTag, JobPosition, JobBranch, JobWorkType, JobExperienceLevel } from "@dentsocia/shared-constants";
import { apiClient } from "./authApi";

export interface SavedSearchCriteria {
  location: string;
  workType: JobWorkType | null;
  position: JobPosition | null;
  branch: JobBranch | null;
  experienceLevel: JobExperienceLevel | null;
  specialties: MicroCompetencyTag[];
}

export interface SavedSearchItem {
  id: string;
  label: string;
  criteria: SavedSearchCriteria;
  createdAt: string;
}

export interface CreateSavedSearchInput {
  label?: string;
  criteria?: {
    location?: string;
    workType?: JobWorkType;
    position?: JobPosition;
    branch?: JobBranch;
    experienceLevel?: JobExperienceLevel;
    specialties?: MicroCompetencyTag[];
  };
}

export async function createSavedSearch(input: CreateSavedSearchInput): Promise<SavedSearchItem> {
  const { data } = await apiClient.post<SavedSearchItem>("/api/v1/saved-searches", input);
  return data;
}

export async function getMySavedSearches(): Promise<SavedSearchItem[]> {
  const { data } = await apiClient.get<{ savedSearches: SavedSearchItem[] }>("/api/v1/saved-searches/mine");
  return data.savedSearches;
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/saved-searches/${id}`);
}
