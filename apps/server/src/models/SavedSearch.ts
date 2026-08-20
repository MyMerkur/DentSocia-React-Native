import { Schema, model, type InferSchemaType } from "mongoose";
import { MICRO_COMPETENCY_TAGS, JOB_POSITIONS, JOB_BRANCHES, JOB_WORK_TYPES, JOB_EXPERIENCE_LEVELS } from "@dentsocia/shared-constants";

// PRD v3 §9.2 — kriter kaydedilir, eşleşen yeni ilan çıktığında bildirim gönderilir
// (job.service.ts → notifyMatchingSavedSearches). Kriter alanları `default: null`/"" ile
// "belirtilmemiş" (her ilanla eşleşir) anlamına gelir — enum + boş string birlikte
// kullanılamadığı için (Mongoose enum validator boş stringi reddeder), null tercih edildi.
const savedSearchCriteriaSchema = new Schema(
  {
    location: { type: String, trim: true, default: "" },
    workType: { type: String, enum: JOB_WORK_TYPES, default: null },
    position: { type: String, enum: JOB_POSITIONS, default: null },
    branch: { type: String, enum: JOB_BRANCHES, default: null },
    experienceLevel: { type: String, enum: JOB_EXPERIENCE_LEVELS, default: null },
    specialties: { type: [String], enum: MICRO_COMPETENCY_TAGS, default: [] },
  },
  { _id: false },
);

const savedSearchSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, trim: true, maxlength: 100, default: "" },
    criteria: { type: savedSearchCriteriaSchema, required: true },
  },
  { timestamps: true },
);

savedSearchSchema.index({ userId: 1, createdAt: -1 });

export type SavedSearch = InferSchemaType<typeof savedSearchSchema>;

export const SavedSearchModel = model("SavedSearch", savedSearchSchema);
