import { Types } from "mongoose";
import {
  createKycDocument,
  findApprovedByUserAndType,
  listByUser,
} from "../repositories/kycDocument.repository";
import { findUserById } from "../repositories/user.repository";
import { createUploadUrl, buildStorageKey, downloadObject, StorageNotConfiguredError } from "../config/storage";
import { analyzeKycDocument, OcrNotConfiguredError, type KycExtraction } from "./ocr.service";
import { notifyKycStatusChange } from "./notification.service";
import { logger } from "../utils/logger";
import { HttpError } from "../utils/httpError";
import { EMPLOYER_ROLES } from "@dentsocia/shared-constants";
import type { KycDocumentStatus, KycDocumentType } from "../models/KycDocument";

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

function decideStatus(extraction: KycExtraction): KycDocumentStatus {
  if (!extraction.isLegible || extraction.confidence === "low") {
    return "needs_review";
  }
  if (!extraction.nameMatchesUser) {
    return "rejected";
  }
  return "approved";
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

    document.status = decideStatus(extraction);
    document.extractedFullName = extraction.extractedFullName;
    document.reviewNote = extraction.notes;
    await document.save();

    if (document.status === "approved") {
      const user = await findUserById(userId);
      if (user) {
        const targetLevel = params.documentType === "kimlik" ? 1 : params.documentType === "diploma" ? 2 : 3;
        user.kycLevel = Math.max(user.kycLevel, targetLevel);
        await user.save();
      }
    }

    logger.info("kyc.document.processed", { documentId: document._id.toString(), status: document.status });
    await notifyKycStatusChange(userId, params.documentType, document.status);
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
