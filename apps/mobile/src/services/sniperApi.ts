import type { MicroCompetencyTag } from "@dentsocia/shared-constants";
import { apiClient } from "./authApi";
import type { BillingInfoInput } from "./subscriptionApi";

export interface SniperCandidate {
  candidateId: string;
  unlocked: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  specialties: string[];
  city: string;
  experienceYears: number | null;
}

export interface SniperSearchFilters {
  specialties?: MicroCompetencyTag[];
  city?: string;
  minExperienceYears?: number;
  maxExperienceYears?: number;
}

export interface SniperThread {
  id: string;
  category: string;
  participant: { id: string; displayName: string; avatarUrl: string | null };
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
}

export interface SniperUnlockResult {
  candidate: SniperCandidate;
  thread: SniperThread;
}

export interface SniperCreditCheckoutSession {
  purchaseId: string;
  token: string;
  checkoutFormContent: string;
}

export async function searchCandidates(filters: SniperSearchFilters): Promise<SniperCandidate[]> {
  const params: Record<string, string | number> = {};
  if (filters.specialties && filters.specialties.length > 0) {
    params.specialties = filters.specialties.join(",");
  }
  if (filters.city) {
    params.city = filters.city;
  }
  if (filters.minExperienceYears !== undefined) {
    params.minExperienceYears = filters.minExperienceYears;
  }
  if (filters.maxExperienceYears !== undefined) {
    params.maxExperienceYears = filters.maxExperienceYears;
  }
  const { data } = await apiClient.get<SniperCandidate[]>("/api/v1/sniper/candidates", { params });
  return data;
}

export async function unlockCandidate(candidateId: string): Promise<SniperUnlockResult> {
  const { data } = await apiClient.post<SniperUnlockResult>(`/api/v1/sniper/candidates/${candidateId}/unlock`);
  return data;
}

export async function startSniperCreditCheckout(
  billingInfo: BillingInfoInput = {},
): Promise<SniperCreditCheckoutSession> {
  const { data } = await apiClient.post<SniperCreditCheckoutSession>("/api/v1/sniper/credits/checkout", billingInfo);
  return data;
}

export async function getSniperCreditBalance(): Promise<{ balance: number }> {
  const { data } = await apiClient.get<{ balance: number }>("/api/v1/sniper/credits/balance");
  return data;
}
