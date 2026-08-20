import type { MicroCompetencyTag } from "@dentsocia/shared-constants";
import { apiClient } from "./authApi";
import type { ReferenceItem } from "./referenceApi";

export interface PublicProfile {
  id: string;
  displayName: string;
  title: string;
  bio: string;
  avatarUrl: string | null;
  workplace: string;
  city: string;
  specialties: MicroCompetencyTag[];
  references: ReferenceItem[];
}

export async function getPublicProfile(userId: string): Promise<PublicProfile> {
  const { data } = await apiClient.get<PublicProfile>(`/api/v1/profiles/${userId}`);
  return data;
}
