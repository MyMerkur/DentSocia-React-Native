import type { MicroCompetencyTag } from "@dentsocia/shared-constants";
import { apiClient } from "./authApi";
import type { BillingInfoInput } from "./subscriptionApi";

export type HubType = "free" | "paid";

export interface HubItem {
  id: string;
  name: string;
  description: string;
  coverImageUrl: string | null;
  ownerId: string;
  isOwner: boolean;
  type: HubType;
  price: string;
  specialties: MicroCompetencyTag[];
  memberCount: number;
  isMember: boolean;
  createdAt: string;
}

export interface HubPostAuthor {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface HubPostItem {
  id: string;
  hubId: string;
  text: string;
  images: string[];
  author: HubPostAuthor;
  createdAt: string;
}

export interface CreateHubInput {
  name: string;
  description?: string;
  type: HubType;
  price?: string;
  specialties?: MicroCompetencyTag[];
}

export interface HubMembershipCheckoutSession {
  membershipId: string;
  token: string;
  checkoutFormContent: string;
}

export async function createHub(input: CreateHubInput): Promise<HubItem> {
  const { data } = await apiClient.post<HubItem>("/api/v1/hubs", input);
  return data;
}

export async function discoverHubs(cursor?: string): Promise<{ hubs: HubItem[]; nextCursor: string | null }> {
  const { data } = await apiClient.get<{ hubs: HubItem[]; nextCursor: string | null }>("/api/v1/hubs", {
    params: cursor ? { cursor } : undefined,
  });
  return data;
}

export async function listMyHubs(): Promise<HubItem[]> {
  const { data } = await apiClient.get<{ hubs: HubItem[] }>("/api/v1/hubs/mine");
  return data.hubs;
}

export async function listManagedHubs(): Promise<HubItem[]> {
  const { data } = await apiClient.get<{ hubs: HubItem[] }>("/api/v1/hubs/managed");
  return data.hubs;
}

export async function getHub(hubId: string): Promise<HubItem> {
  const { data } = await apiClient.get<HubItem>(`/api/v1/hubs/${hubId}`);
  return data;
}

export async function joinFreeHub(hubId: string): Promise<HubItem> {
  const { data } = await apiClient.post<HubItem>(`/api/v1/hubs/${hubId}/join`);
  return data;
}

export async function startHubMembershipCheckout(
  hubId: string,
  billingInfo: BillingInfoInput = {},
): Promise<HubMembershipCheckoutSession> {
  const { data } = await apiClient.post<HubMembershipCheckoutSession>(
    `/api/v1/hubs/${hubId}/membership/checkout`,
    billingInfo,
  );
  return data;
}

export async function leaveHub(hubId: string): Promise<{ status: string }> {
  const { data } = await apiClient.post<{ status: string }>(`/api/v1/hubs/${hubId}/leave`);
  return data;
}

export async function listHubPosts(
  hubId: string,
  cursor?: string,
): Promise<{ posts: HubPostItem[]; nextCursor: string | null }> {
  const { data } = await apiClient.get<{ posts: HubPostItem[]; nextCursor: string | null }>(
    `/api/v1/hubs/${hubId}/posts`,
    { params: cursor ? { cursor } : undefined },
  );
  return data;
}

export async function createHubPost(hubId: string, text: string): Promise<HubPostItem> {
  const { data } = await apiClient.post<HubPostItem>(`/api/v1/hubs/${hubId}/posts`, { text });
  return data;
}
