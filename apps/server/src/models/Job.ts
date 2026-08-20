import { Schema, model, type InferSchemaType } from "mongoose";
import {
  MICRO_COMPETENCY_TAGS,
  EMPLOYER_ROLES,
  JOB_POSITIONS,
  JOB_BRANCHES,
  JOB_WORK_TYPES,
  JOB_WEEKDAYS,
  JOB_PAYMENT_MODELS,
  JOB_EXPERIENCE_LEVELS,
  JOB_SALARY_TYPES,
  JOB_CLINIC_AMENITIES,
} from "@dentsocia/shared-constants";

export const JOB_STATUSES = ["open", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export { EMPLOYER_ROLES };

// PRD v3 §8.1/§8.2 alanları. Zorunluluk yalnızca validators/job.validator.ts'te uygulanır —
// var olan ilanların bu alanları yoktur, şemada `required` koymak onları bozar.
const jobSchema = new Schema(
  {
    employerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 3000, default: "" },
    location: { type: String, trim: true, maxlength: 120, default: "" },
    specialties: { type: [String], enum: MICRO_COMPETENCY_TAGS, default: [] },
    status: { type: String, enum: JOB_STATUSES, default: "open" },
    position: { type: String, enum: JOB_POSITIONS, default: null },
    branch: { type: String, enum: JOB_BRANCHES, default: null },
    workType: { type: String, enum: JOB_WORK_TYPES, default: null },
    workDays: { type: [String], enum: JOB_WEEKDAYS, default: [] },
    workHoursStart: { type: String, default: "" },
    workHoursEnd: { type: String, default: "" },
    paymentModel: { type: String, enum: JOB_PAYMENT_MODELS, default: null },
    experienceLevel: { type: String, enum: JOB_EXPERIENCE_LEVELS, default: null },
    hasSgk: { type: Boolean, default: null },
    salaryMin: { type: Number, default: null },
    salaryMax: { type: Number, default: null },
    salaryType: { type: String, enum: JOB_SALARY_TYPES, default: null },
    premiumPercentage: { type: Number, default: null },
    clinicAmenities: { type: [String], enum: JOB_CLINIC_AMENITIES, default: [] },
    unitCount: { type: Number, default: null },
    employeeDentistCount: { type: Number, default: null },
  },
  { timestamps: true },
);

jobSchema.index({ createdAt: -1 });

export type Job = InferSchemaType<typeof jobSchema>;

export const JobModel = model("Job", jobSchema);
