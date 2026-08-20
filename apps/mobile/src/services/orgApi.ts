import type { MicroCompetencyTag } from "@dentsocia/shared-constants";
import { apiClient } from "./authApi";
import type { UserProfile } from "./profileApi";
import type { BillingInfoInput } from "./subscriptionApi";

export interface OrgSearchResult {
  id: string;
  displayName: string;
  workplace: string;
}

export interface OrgTeamMember {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface OrgOpenJob {
  id: string;
  title: string;
  location: string;
  specialties: MicroCompetencyTag[];
  createdAt: string;
}

export interface OrgRecentCase {
  id: string;
  title: string;
  imageUrl: string | null;
  createdAt: string;
}

export interface OrgRating {
  average: number;
  count: number;
}

export interface OrgReview {
  id: string;
  rating: number;
  comment: string;
  author: { id: string; displayName: string; avatarUrl: string | null };
  createdAt: string;
}

export interface OrgProfile {
  id: string;
  role: string;
  displayName: string;
  title: string;
  bio: string;
  avatarUrl: string | null;
  workplace: string;
  city: string;
  specialties: MicroCompetencyTag[];
  isVerifiedOrg: boolean;
  team: OrgTeamMember[];
  openJobs: OrgOpenJob[];
  recentCases: OrgRecentCase[];
  rating: OrgRating;
}

export interface OrgAnnouncement {
  id: string;
  orgId: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface OrgVoteResultOption {
  option: string;
  count: number;
}

export interface OrgVote {
  id: string;
  orgId: string;
  question: string;
  status: "open" | "closed";
  results: OrgVoteResultOption[];
  myOptionIndex: number | null;
  createdAt: string;
}

export async function searchOrgs(query: string): Promise<OrgSearchResult[]> {
  const { data } = await apiClient.get<{ orgs: OrgSearchResult[] }>("/api/v1/orgs/search", { params: { q: query } });
  return data.orgs;
}

export async function getOrgProfile(userId: string): Promise<OrgProfile> {
  const { data } = await apiClient.get<OrgProfile>(`/api/v1/orgs/${userId}`);
  return data;
}

export async function setAffiliation(orgUserId: string | null): Promise<UserProfile> {
  const { data } = await apiClient.patch<UserProfile>("/api/v1/users/me/affiliation", { orgUserId });
  return data;
}

export interface MyAffiliationRequest {
  id: string;
  orgId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export async function requestAffiliation(orgUserId: string): Promise<MyAffiliationRequest> {
  const { data } = await apiClient.post<MyAffiliationRequest>("/api/v1/users/me/affiliation-requests", { orgUserId });
  return data;
}

export async function listMyAffiliationRequests(): Promise<MyAffiliationRequest[]> {
  const { data } = await apiClient.get<MyAffiliationRequest[]>("/api/v1/users/me/affiliation-requests");
  return data;
}

export interface PendingAffiliationRequest {
  id: string;
  applicant: { id: string; displayName: string; avatarUrl: string | null };
  createdAt: string;
}

export async function listAffiliationRequests(orgId: string): Promise<PendingAffiliationRequest[]> {
  const { data } = await apiClient.get<PendingAffiliationRequest[]>(`/api/v1/orgs/${orgId}/affiliation-requests`);
  return data;
}

export async function approveAffiliationRequest(orgId: string, requestId: string): Promise<void> {
  await apiClient.post(`/api/v1/orgs/${orgId}/affiliation-requests/${requestId}/approve`);
}

export async function rejectAffiliationRequest(orgId: string, requestId: string): Promise<void> {
  await apiClient.post(`/api/v1/orgs/${orgId}/affiliation-requests/${requestId}/reject`);
}

export async function rateOrg(orgId: string, rating: number, comment?: string): Promise<{ id: string; rating: number; comment: string }> {
  const { data } = await apiClient.post(`/api/v1/orgs/${orgId}/reviews`, { rating, comment });
  return data;
}

export async function getOrgReviews(orgId: string): Promise<OrgReview[]> {
  const { data } = await apiClient.get<{ reviews: OrgReview[] }>(`/api/v1/orgs/${orgId}/reviews`);
  return data.reviews;
}

export async function listAnnouncements(orgId: string): Promise<OrgAnnouncement[]> {
  const { data } = await apiClient.get<{ announcements: OrgAnnouncement[] }>(`/api/v1/orgs/${orgId}/announcements`);
  return data.announcements;
}

export async function createAnnouncement(orgId: string, input: { title: string; body: string }): Promise<OrgAnnouncement> {
  const { data } = await apiClient.post<OrgAnnouncement>(`/api/v1/orgs/${orgId}/announcements`, input);
  return data;
}

export async function listVotes(orgId: string): Promise<OrgVote[]> {
  const { data } = await apiClient.get<{ votes: OrgVote[] }>(`/api/v1/orgs/${orgId}/votes`);
  return data.votes;
}

export async function createVote(orgId: string, input: { question: string; options: string[] }): Promise<OrgVote> {
  const { data } = await apiClient.post<OrgVote>(`/api/v1/orgs/${orgId}/votes`, input);
  return data;
}

export async function castBallot(voteId: string, optionIndex: number): Promise<OrgVote> {
  const { data } = await apiClient.post<OrgVote>(`/api/v1/orgs/votes/${voteId}/ballot`, { optionIndex });
  return data;
}

export async function closeVote(voteId: string): Promise<OrgVote> {
  const { data } = await apiClient.post<OrgVote>(`/api/v1/orgs/votes/${voteId}/close`);
  return data;
}

export type OrgDuesPaymentInterval = "MONTHLY" | "YEARLY";

export interface OrgDuesPlan {
  id: string;
  orgId: string;
  name: string;
  price: string;
  paymentInterval: OrgDuesPaymentInterval;
  createdAt: string;
}

export interface OrgDuesCheckoutSession {
  subscriptionId: string;
  token: string;
  checkoutFormContent: string;
}

export interface OrgDuesSubscriber {
  id: string;
  status: "pending_checkout" | "active" | "past_due" | "canceled" | "expired";
  currentPeriodEnd: string | null;
  member: { id: string; displayName: string; avatarUrl: string | null };
}

export async function getDuesPlan(orgId: string): Promise<OrgDuesPlan | null> {
  const { data } = await apiClient.get<OrgDuesPlan | null>(`/api/v1/orgs/${orgId}/dues-plan`);
  return data;
}

export async function createDuesPlan(
  orgId: string,
  input: { name?: string; price: string; paymentInterval: OrgDuesPaymentInterval },
): Promise<OrgDuesPlan> {
  const { data } = await apiClient.post<OrgDuesPlan>(`/api/v1/orgs/${orgId}/dues-plan`, input);
  return data;
}

export async function startDuesCheckout(
  orgId: string,
  billingInfo: BillingInfoInput = {},
): Promise<OrgDuesCheckoutSession> {
  const { data } = await apiClient.post<OrgDuesCheckoutSession>(`/api/v1/orgs/${orgId}/dues/checkout`, billingInfo);
  return data;
}

export async function cancelDuesSubscription(orgId: string): Promise<{ status: string }> {
  const { data } = await apiClient.post<{ status: string }>(`/api/v1/orgs/${orgId}/dues/cancel`);
  return data;
}

export async function listDuesSubscribers(orgId: string): Promise<OrgDuesSubscriber[]> {
  const { data } = await apiClient.get<{ subscribers: OrgDuesSubscriber[] }>(`/api/v1/orgs/${orgId}/dues/subscribers`);
  return data.subscribers;
}

export interface MyDuesStatus {
  status: "none" | "pending_checkout" | "active" | "past_due" | "canceled" | "expired";
  currentPeriodEnd: string | null;
}

export async function getMyDuesStatus(orgId: string): Promise<MyDuesStatus> {
  const { data } = await apiClient.get<MyDuesStatus>(`/api/v1/orgs/${orgId}/dues/mine`);
  return data;
}
