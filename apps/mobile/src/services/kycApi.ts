import { apiClient } from "./authApi";

export type KycDocumentType = "kimlik" | "diploma" | "kurumsal_belge";
export type KycDocumentStatus = "pending" | "approved" | "rejected";
export type KycContentType = "image/jpeg" | "image/png" | "application/pdf";

export interface KycDocumentItem {
  id: string;
  documentType: KycDocumentType;
  status: KycDocumentStatus;
  createdAt: string;
}

export async function requestKycUploadUrl(
  documentType: KycDocumentType,
  contentType: KycContentType,
): Promise<{ uploadUrl: string; storageKey: string }> {
  const { data } = await apiClient.post<{ uploadUrl: string; storageKey: string }>("/api/v1/kyc/documents/upload-url", {
    documentType,
    contentType,
  });
  return data;
}

export async function confirmKycUpload(params: {
  documentType: KycDocumentType;
  storageKey: string;
  contentType: KycContentType;
  claimedFullName: string;
}): Promise<{ id: string; documentType: KycDocumentType; status: KycDocumentStatus }> {
  const { data } = await apiClient.post<{ id: string; documentType: KycDocumentType; status: KycDocumentStatus }>(
    "/api/v1/kyc/documents",
    params,
  );
  return data;
}

export async function listKycDocuments(): Promise<KycDocumentItem[]> {
  const { data } = await apiClient.get<{ documents: KycDocumentItem[] }>("/api/v1/kyc/documents");
  return data.documents;
}
