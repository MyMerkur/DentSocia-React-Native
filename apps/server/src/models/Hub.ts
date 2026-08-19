import { Schema, model, type InferSchemaType } from "mongoose";
import { MICRO_COMPETENCY_TAGS } from "@dentsocia/shared-constants";

export const HUB_TYPES = ["free", "paid"] as const;
export type HubType = (typeof HUB_TYPES)[number];

const hubSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    coverImageKey: { type: String, default: "" },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: HUB_TYPES, required: true },
    price: { type: String, default: "" },
    iyzicoProductReferenceCode: { type: String, default: "" },
    iyzicoPricingPlanReferenceCode: { type: String, default: "" },
    specialties: { type: [String], enum: MICRO_COMPETENCY_TAGS, default: [] },
    memberCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

hubSchema.index({ createdAt: -1 });
hubSchema.index({ ownerId: 1 });

export type Hub = InferSchemaType<typeof hubSchema>;

export const HubModel = model("Hub", hubSchema);
