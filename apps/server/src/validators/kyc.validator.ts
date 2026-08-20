import { z } from "zod";
import { KYC_DOCUMENT_TYPES } from "../models/KycDocument";

const supportedContentTypes = z.enum(["image/jpeg", "image/png", "application/pdf"]);

export const uploadUrlSchema = z.object({
  documentType: z.enum(KYC_DOCUMENT_TYPES),
  contentType: supportedContentTypes,
});

export const confirmUploadSchema = z.object({
  documentType: z.enum(KYC_DOCUMENT_TYPES),
  storageKey: z.string().min(1),
  contentType: supportedContentTypes,
  claimedFullName: z.string().min(2).max(120),
});

export const reviewDocumentSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    note: z.string().max(500).optional(),
  })
  .strict();
