import { Schema, model, type InferSchemaType } from "mongoose";

// PRD v3 §5.1 — "Şikâyet: Tek altyapı — vaka, ilan, kullanıcı, mesaj."
export const REPORT_TARGET_TYPES = ["case", "job", "user", "message"] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  "spam",
  "inappropriate_content",
  "fake_profile",
  "harassment",
  "fraud",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

const reportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: REPORT_TARGET_TYPES, required: true },
    // Polimorfik — hedefin gerçek koleksiyonu targetType'a göre değişir, bu yüzden `ref` yok.
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, trim: true, maxlength: 500, default: "" },
    status: { type: String, enum: REPORT_STATUSES, default: "open" },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true },
);

reportSchema.index({ status: 1, createdAt: 1 });

export type Report = InferSchemaType<typeof reportSchema>;

export const ReportModel = model("Report", reportSchema);
