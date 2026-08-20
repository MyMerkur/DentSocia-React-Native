import { Schema, model, type InferSchemaType } from "mongoose";
import { MICRO_COMPETENCY_TAGS } from "@dentsocia/shared-constants";

const courseSchema = new Schema(
  {
    instructorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 3000, default: "" },
    specialties: { type: [String], enum: MICRO_COMPETENCY_TAGS, default: [] },
  },
  { timestamps: true },
);

courseSchema.index({ createdAt: -1 });

export type Course = InferSchemaType<typeof courseSchema>;

export const CourseModel = model("Course", courseSchema);
