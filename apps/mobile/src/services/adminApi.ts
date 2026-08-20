import { apiClient } from "./authApi";
import type { KycDocumentType } from "./kycApi";

export interface PendingKycDocument {
  id: string;
  documentType: KycDocumentType;
  claimedFullName: string;
  extractedFullName: string | null;
  aiConfidence: "high" | "medium" | "low" | null;
  aiNameMatches: boolean | null;
  reviewNote: string | null;
  applicant: { id: string; displayName: string; avatarUrl: string | null };
  createdAt: string;
}

export async function getPendingKycDocuments(): Promise<PendingKycDocument[]> {
  const { data } = await apiClient.get<{ documents: PendingKycDocument[] }>("/api/v1/kyc/documents/pending");
  return data.documents;
}

export async function reviewKycDocument(
  documentId: string,
  decision: "approved" | "rejected",
  note?: string,
): Promise<void> {
  await apiClient.post(`/api/v1/kyc/documents/${documentId}/review`, { decision, note });
}

export type ReportTargetType = "case" | "job" | "user" | "message";
export type ReportReason = "spam" | "inappropriate_content" | "fake_profile" | "harassment" | "fraud" | "other";

export interface OpenReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string;
  status: "open" | "resolved" | "dismissed";
  reporter: { id: string; displayName: string; avatarUrl: string | null };
  createdAt: string;
}

export async function getOpenReports(): Promise<OpenReport[]> {
  const { data } = await apiClient.get<{ reports: OpenReport[] }>("/api/v1/reports", { params: { status: "open" } });
  return data.reports;
}

export async function resolveReport(
  reportId: string,
  status: "resolved" | "dismissed",
  resolutionNote?: string,
): Promise<void> {
  await apiClient.post(`/api/v1/reports/${reportId}/resolve`, { status, resolutionNote });
}
