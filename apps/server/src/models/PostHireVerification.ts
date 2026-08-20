import { Schema, model, type InferSchemaType } from "mongoose";

export const POST_HIRE_VERIFICATION_STATUSES = ["pending", "answered"] as const;
export type PostHireVerificationStatus = (typeof POST_HIRE_VERIFICATION_STATUSES)[number];

export const POST_HIRE_VERIFICATION_DELAY_MS = 90 * 24 * 60 * 60 * 1000;

// PRD v3 §8.5 — ilan sonrası doğrulama. `jobTitle` bilinçli olarak denormalize edildi:
// bildirim metni ve soru kartı, `Job` silinmiş/değiştirilmiş olsa bile aynı kalmalı.
const postHireVerificationSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    employerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    jobTitle: { type: String, required: true, trim: true, maxlength: 150 },
    dueAt: { type: Date, required: true },
    notifiedAt: { type: Date, default: null },
    status: { type: String, enum: POST_HIRE_VERIFICATION_STATUSES, default: "pending" },
    answer: { type: Boolean, default: null },
    answeredAt: { type: Date, default: null },
  },
  { timestamps: true },
);

postHireVerificationSchema.index({ status: 1, dueAt: 1, notifiedAt: 1 });
postHireVerificationSchema.index({ candidateId: 1, status: 1, dueAt: 1 });
postHireVerificationSchema.index({ employerId: 1, status: 1 });

export type PostHireVerification = InferSchemaType<typeof postHireVerificationSchema>;

export const PostHireVerificationModel = model("PostHireVerification", postHireVerificationSchema);
