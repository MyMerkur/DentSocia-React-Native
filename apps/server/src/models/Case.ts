import { Schema, model, type InferSchemaType } from "mongoose";
import { MICRO_COMPETENCY_TAGS } from "@dentsocia/shared-constants";

export const CASE_STAGES = ["before", "during", "after"] as const;
export type CaseStage = (typeof CASE_STAGES)[number];

const caseImageSchema = new Schema(
  {
    storageKey: { type: String, required: true },
    stage: { type: String, enum: CASE_STAGES, required: true },
  },
  { _id: false },
);

const caseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    specialties: { type: [String], enum: MICRO_COMPETENCY_TAGS, default: [] },
    images: { type: [caseImageSchema], default: [] },
  },
  { timestamps: true },
);

caseSchema.index({ createdAt: -1 });

export type Case = InferSchemaType<typeof caseSchema>;

export const CaseModel = model("Case", caseSchema);
