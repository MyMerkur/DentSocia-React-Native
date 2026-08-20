import { Schema, model, type InferSchemaType } from "mongoose";
import { MICRO_COMPETENCY_TAGS, EMPLOYER_ROLES } from "@dentsocia/shared-constants";

export const JOB_STATUSES = ["open", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export { EMPLOYER_ROLES };

const jobSchema = new Schema(
  {
    employerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 3000, default: "" },
    location: { type: String, trim: true, maxlength: 120, default: "" },
    specialties: { type: [String], enum: MICRO_COMPETENCY_TAGS, default: [] },
    status: { type: String, enum: JOB_STATUSES, default: "open" },
  },
  { timestamps: true },
);

jobSchema.index({ createdAt: -1 });

export type Job = InferSchemaType<typeof jobSchema>;

export const JobModel = model("Job", jobSchema);
