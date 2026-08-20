import { z } from "zod";
import {
  MICRO_COMPETENCY_TAGS,
  JOB_POSITIONS,
  JOB_BRANCHES,
  JOB_WORK_TYPES,
  JOB_WEEKDAYS,
  JOB_PAYMENT_MODELS,
  JOB_EXPERIENCE_LEVELS,
  JOB_SALARY_TYPES,
  JOB_CLINIC_AMENITIES,
} from "@dentsocia/shared-constants";
import { JOB_STATUSES } from "../models/Job";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

// PRD v3 §8.1 — zorunlu alanlar; §8.2 — opsiyonel/teşvikli alanlar.
export const createJobSchema = z
  .object({
    title: z.string().min(3).max(150),
    description: z.string().min(10).max(3000),
    location: z.string().min(1).max(120),
    specialties: z.array(z.enum(MICRO_COMPETENCY_TAGS)).max(8).optional(),
    position: z.enum(JOB_POSITIONS),
    branch: z.enum(JOB_BRANCHES),
    workType: z.enum(JOB_WORK_TYPES),
    workDays: z.array(z.enum(JOB_WEEKDAYS)).min(1),
    workHoursStart: z.string().regex(TIME_REGEX, "HH:mm biçiminde olmalı"),
    workHoursEnd: z.string().regex(TIME_REGEX, "HH:mm biçiminde olmalı"),
    paymentModel: z.enum(JOB_PAYMENT_MODELS),
    experienceLevel: z.enum(JOB_EXPERIENCE_LEVELS),
    hasSgk: z.boolean(),
    salaryMin: z.number().min(0).optional(),
    salaryMax: z.number().min(0).optional(),
    salaryType: z.enum(JOB_SALARY_TYPES).optional(),
    premiumPercentage: z.number().min(0).max(100).optional(),
    clinicAmenities: z.array(z.enum(JOB_CLINIC_AMENITIES)).optional(),
    unitCount: z.number().int().min(0).optional(),
    employeeDentistCount: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((data) => data.salaryMin === undefined || data.salaryMax === undefined || data.salaryMin <= data.salaryMax, {
    message: "Min maaş, max maaştan büyük olamaz",
    path: ["salaryMin"],
  })
  .refine((data) => (data.salaryMin === undefined && data.salaryMax === undefined) || data.salaryType !== undefined, {
    message: "Maaş aralığı girildiyse net/brüt seçimi zorunludur",
    path: ["salaryType"],
  });

export const jobStatusSchema = z
  .object({
    status: z.enum(JOB_STATUSES),
  })
  .strict();

export const jobsQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const markJobFilledSchema = z
  .object({
    applicationId: z.string().min(1),
  })
  .strict();
