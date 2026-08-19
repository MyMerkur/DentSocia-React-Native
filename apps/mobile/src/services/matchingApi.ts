import type { MicroCompetencyTag } from "@dentsocia/shared-constants";
import { apiClient } from "./authApi";

export type SwipeDirection = "left" | "right";

export interface SwipeJobEmployer {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface SwipeJobCard {
  id: string;
  title: string;
  description: string;
  location: string;
  specialties: MicroCompetencyTag[];
  employer: SwipeJobEmployer;
  createdAt: string;
}

export interface SwipeCandidateCard {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  desiredPositions: MicroCompetencyTag[];
  experienceYears: number | null;
}

export interface MatchResult {
  id: string;
  jobId: string;
  threadId: string;
}

export interface SwipeResponse {
  matched: boolean;
  match?: MatchResult;
}

export interface MatchItem {
  id: string;
  job: { id: string; title: string };
  counterpart: { id: string; displayName: string; avatarUrl: string | null };
  counterpartRole: "candidate" | "employer";
  threadId: string;
  createdAt: string;
}

export async function getJobSwipeFeed(): Promise<SwipeJobCard[]> {
  const { data } = await apiClient.get<{ jobs: SwipeJobCard[] }>("/api/v1/matching/jobs/feed");
  return data.jobs;
}

export async function swipeJob(jobId: string, direction: SwipeDirection): Promise<SwipeResponse> {
  const { data } = await apiClient.post<SwipeResponse>(`/api/v1/matching/jobs/${jobId}/swipe`, { direction });
  return data;
}

export async function getCandidateSwipeFeed(jobId: string): Promise<SwipeCandidateCard[]> {
  const { data } = await apiClient.get<{ candidates: SwipeCandidateCard[] }>(`/api/v1/matching/jobs/${jobId}/candidates`);
  return data.candidates;
}

export async function swipeCandidate(jobId: string, candidateId: string, direction: SwipeDirection): Promise<SwipeResponse> {
  const { data } = await apiClient.post<SwipeResponse>(
    `/api/v1/matching/jobs/${jobId}/candidates/${candidateId}/swipe`,
    { direction },
  );
  return data;
}

export async function getMatches(): Promise<MatchItem[]> {
  const { data } = await apiClient.get<{ matches: MatchItem[] }>("/api/v1/matching/matches");
  return data.matches;
}
