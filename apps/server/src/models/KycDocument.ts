import { Schema, model, type InferSchemaType } from "mongoose";

export const KYC_DOCUMENT_TYPES = ["kimlik", "diploma", "kurumsal_belge"] as const;
// PRD v3 §6.2 — MVP'de tüm onaylar manueldir. "pending" tek ara durum: karar yalnızca
// admin'in reviewDocument()'ıyla verilir, AI hiçbir zaman approved/rejected'a karar vermez.
export const KYC_DOCUMENT_STATUSES = ["pending", "approved", "rejected"] as const;
export const KYC_AI_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export type KycDocumentType = (typeof KYC_DOCUMENT_TYPES)[number];
export type KycDocumentStatus = (typeof KYC_DOCUMENT_STATUSES)[number];
export type KycAiConfidence = (typeof KYC_AI_CONFIDENCE_LEVELS)[number];

const kycDocumentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    documentType: { type: String, enum: KYC_DOCUMENT_TYPES, required: true },
    storageKey: { type: String, required: true },
    contentType: { type: String, required: true },
    claimedFullName: { type: String, required: true },
    status: { type: String, enum: KYC_DOCUMENT_STATUSES, default: "pending" },
    extractedFullName: { type: String, default: null },
    reviewNote: { type: String, default: null },
    // AI ön-ayıklama sonucu — karar vermiyor, sadece admin kuyruğunda gösteriliyor (§6.2).
    aiConfidence: { type: String, enum: KYC_AI_CONFIDENCE_LEVELS, default: null },
    aiNameMatches: { type: Boolean, default: null },
    // Doğrulama kaydı — kim, ne zaman onayladı (§6.3).
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type KycDocument = InferSchemaType<typeof kycDocumentSchema>;

export const KycDocumentModel = model("KycDocument", kycDocumentSchema);
