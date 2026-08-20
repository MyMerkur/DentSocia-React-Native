import { Types } from "mongoose";
import {
  createKycDocument,
  findApprovedByUserAndType,
  listByUser,
  listPending,
  findById,
  updateReview,
} from "../repositories/kycDocument.repository";
import { findUserById } from "../repositories/user.repository";
import { createUploadUrl, buildStorageKey, downloadObject, StorageNotConfiguredError } from "../config/storage";
import { analyzeKycDocument, OcrNotConfiguredError, type KycExtraction } from "./ocr.service";
import { notifyKycStatusChange } from "./notification.service";
import { resolveUserSummary, type UserSummarySource } from "../utils/userSummary";
import { logger } from "../utils/logger";
import { HttpError } from "../utils/httpError";
import { EMPLOYER_ROLES } from "@dentsocia/shared-constants";
import type { KycAiConfidence, KycDocumentType } from "../models/KycDocument";

export async function requestUploadUrl(userId: string, documentType: KycDocumentType, contentType: string) {
  const storageKey = buildStorageKey(userId, documentType, contentType);
  const uploadUrl = await createUploadUrl(storageKey, contentType);
  return { uploadUrl, storageKey };
}

interface ConfirmUploadParams {
  documentType: KycDocumentType;
  storageKey: string;
  contentType: string;
  claimedFullName: string;
}

// PRD v3 §6.2 — AI karar vermez, yalnızca onay kuyruğunu hızlandıran bir ön-ayıklama sinyali
// üretir. Statü belirlemiyor; document.status confirmUpload'ta her zaman "pending" kalır.
function deriveAiSignal(extraction: KycExtraction): { aiConfidence: KycAiConfidence; aiNameMatches: boolean } {
  return {
    aiConfidence: extraction.isLegible ? extraction.confidence : "low",
    aiNameMatches: extraction.nameMatchesUser,
  };
}

export async function confirmUpload(userId: string, params: ConfirmUploadParams) {
  const userObjectId = new Types.ObjectId(userId);

  const requester = await findUserById(userId);
  if (!requester) {
    throw new HttpError("Kullanıcı bulunamadı", 404);
  }

  if (params.documentType === "diploma") {
    const approvedKimlik = await findApprovedByUserAndType(userObjectId, "kimlik");
    if (!approvedKimlik) {
      throw new HttpError("Diploma yüklemeden önce kimlik onaylanmalı", 409);
    }
  }

  if (params.documentType === "kurumsal_belge" && !(EMPLOYER_ROLES as readonly string[]).includes(requester.role)) {
    throw new HttpError("Sadece klinik/firma/dernek hesapları kurumsal belge yükleyebilir", 403);
  }

  // storageKey is client-supplied — without this check, a caller could submit any key (guessed,
  // leaked, or reused from another response) and have it processed as their own KYC document.
  // requestUploadUrl always issues keys under kyc/{userId}/{documentType}/..., so both segments
  // must match the actual requester and the declared document type.
  if (!params.storageKey.startsWith(`kyc/${userId}/${params.documentType}/`)) {
    throw new HttpError("Geçersiz dosya anahtarı", 400);
  }

  const document = await createKycDocument({
    userId: userObjectId,
    documentType: params.documentType,
    storageKey: params.storageKey,
    contentType: params.contentType,
    claimedFullName: params.claimedFullName,
  });

  try {
    const { buffer, contentType } = await downloadObject(params.storageKey);
    const extraction = await analyzeKycDocument({
      documentType: params.documentType,
      contentType,
      fileBuffer: buffer,
      expectedFullName: params.claimedFullName,
    });

    const { aiConfidence, aiNameMatches } = deriveAiSignal(extraction);
    document.extractedFullName = extraction.extractedFullName;
    document.reviewNote = extraction.notes;
    document.aiConfidence = aiConfidence;
    document.aiNameMatches = aiNameMatches;
    await document.save();

    logger.info("kyc.document.processed", { documentId: document._id.toString(), aiConfidence, aiNameMatches });
    await notifyKycStatusChange(userId, params.documentType, "pending");
  } catch (error) {
    if (error instanceof StorageNotConfiguredError || error instanceof OcrNotConfiguredError) {
      logger.info("kyc.document.verification_deferred", {
        documentId: document._id.toString(),
        reason: error.message,
      });
    } else {
      throw error;
    }
  }

  return document;
}

export async function listUserDocuments(userId: string) {
  return listByUser(new Types.ObjectId(userId));
}

export async function listPendingDocuments() {
  const documents = await listPending();
  return Promise.all(
    documents.map(async (document) => {
      const applicant = await resolveUserSummary(document.userId as unknown as UserSummarySource);
      return {
        id: document._id.toString(),
        documentType: document.documentType,
        claimedFullName: document.claimedFullName,
        extractedFullName: document.extractedFullName,
        aiConfidence: document.aiConfidence,
        aiNameMatches: document.aiNameMatches,
        reviewNote: document.reviewNote,
        applicant,
        createdAt: document.createdAt,
      };
    }),
  );
}

export async function reviewDocument(adminUserId: string, documentId: string, decision: "approved" | "rejected", note?: string) {
  const document = await findById(documentId);
  if (!document || document.status !== "pending") {
    throw new HttpError("Belge bulunamadı veya zaten değerlendirilmiş", 404);
  }

  const updated = await updateReview(documentId, {
    status: decision,
    reviewedBy: new Types.ObjectId(adminUserId),
    reviewedAt: new Date(),
    ...(note !== undefined && { reviewNote: note }),
  });

  if (decision === "approved") {
    const user = await findUserById(document.userId.toString());
    if (user) {
      const targetLevel = document.documentType === "kimlik" ? 1 : document.documentType === "diploma" ? 2 : 3;
      user.kycLevel = Math.max(user.kycLevel, targetLevel);
      await user.save();
    }
  }

  await notifyKycStatusChange(document.userId.toString(), document.documentType, decision);

  return {
    id: updated!._id.toString(),
    documentType: updated!.documentType,
    status: updated!.status,
  };
}
