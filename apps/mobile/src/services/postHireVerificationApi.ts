import { apiClient } from "./authApi";

export interface PostHireVerificationItem {
  id: string;
  jobId: string;
  jobTitle: string;
  dueAt: string;
  status: "pending" | "answered";
  answer: boolean | null;
  answeredAt: string | null;
}

export async function getMyPendingVerifications(): Promise<PostHireVerificationItem[]> {
  const { data } = await apiClient.get<{ verifications: PostHireVerificationItem[] }>("/api/v1/post-hire-verifications/mine");
  return data.verifications;
}

export async function answerVerification(id: string, answer: boolean): Promise<PostHireVerificationItem> {
  const { data } = await apiClient.post<PostHireVerificationItem>(`/api/v1/post-hire-verifications/${id}/answer`, { answer });
  return data;
}
