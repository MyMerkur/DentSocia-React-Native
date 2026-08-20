import { Schema, model, type InferSchemaType } from "mongoose";
import { MICRO_COMPETENCY_TAGS } from "@dentsocia/shared-constants";

export const USER_ROLES = ["hekim", "asistan", "teknisyen", "klinik", "firma", "dernek"] as const;

const showcaseSchema = new Schema(
  {
    displayName: { type: String, trim: true, maxlength: 120, default: "" },
    title: { type: String, trim: true, maxlength: 120, default: "" },
    bio: { type: String, trim: true, maxlength: 500, default: "" },
    avatarKey: { type: String, default: null },
    workplace: { type: String, trim: true, maxlength: 160, default: "" },
    city: { type: String, trim: true, maxlength: 100, default: "" },
    specialties: { type: [String], enum: MICRO_COMPETENCY_TAGS, default: [] },
  },
  { _id: false },
);

const experienceEntrySchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    workplace: { type: String, required: true, trim: true, maxlength: 160 },
    startYear: { type: Number, required: true },
    endYear: { type: Number, default: null },
  },
  { _id: false },
);

const careerSchema = new Schema(
  {
    openToWork: { type: Boolean, default: false },
    hiddenSearch: { type: Boolean, default: false },
    desiredPositions: { type: [String], enum: MICRO_COMPETENCY_TAGS, default: [] },
    experienceYears: { type: Number, default: null },
    experience: { type: [experienceEntrySchema], default: [] },
  },
  { _id: false },
);

const billingInfoSchema = new Schema(
  {
    identityNumberEncrypted: { type: String, default: "" },
    phone: { type: String, trim: true, maxlength: 20, default: "" },
    address: { type: String, trim: true, maxlength: 300, default: "" },
    city: { type: String, trim: true, maxlength: 100, default: "" },
    country: { type: String, trim: true, maxlength: 100, default: "Türkiye" },
    zipCode: { type: String, trim: true, maxlength: 20, default: "" },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, required: true },
    kycLevel: { type: Number, min: 0, max: 4, default: 0 },
    jobPostingCreditsBalance: { type: Number, default: 0 },
    freeJobPostsUsed: { type: Number, default: 0 },
    sniperCreditsBalance: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    showcase: { type: showcaseSchema, default: () => ({}) },
    career: { type: careerSchema, default: () => ({}) },
    billingInfo: { type: billingInfoSchema, default: () => ({}) },
    affiliatedOrgId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;

export const UserModel = model("User", userSchema);
