import { z } from "zod";
import { MICRO_COMPETENCY_TAGS } from "@dentsocia/shared-constants";

const currentYear = new Date().getFullYear();

const tagListSchema = z.array(z.enum(MICRO_COMPETENCY_TAGS)).max(8);

export const updateShowcaseSchema = z
  .object({
    displayName: z.string().min(2).max(120).optional(),
    title: z.string().max(120).optional(),
    bio: z.string().max(500).optional(),
    avatarKey: z.string().max(300).optional(),
    workplace: z.string().max(160).optional(),
    city: z.string().max(100).optional(),
    specialties: tagListSchema.optional(),
  })
  .strict();

const experienceEntrySchema = z.object({
  title: z.string().min(1).max(120),
  workplace: z.string().min(1).max(160),
  startYear: z.number().int().min(1950).max(currentYear + 1),
  endYear: z
    .number()
    .int()
    .min(1950)
    .max(currentYear + 1)
    .nullable()
    .optional(),
});

export const updateCareerSchema = z
  .object({
    openToWork: z.boolean().optional(),
    hiddenSearch: z.boolean().optional(),
    desiredPositions: tagListSchema.optional(),
    experienceYears: z.number().int().min(0).max(60).optional(),
    experience: z.array(experienceEntrySchema).max(20).optional(),
  })
  .strict();

export const avatarUploadUrlSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png"]),
});

export const affiliationSchema = z
  .object({
    orgUserId: z.string().nullable(),
  })
  .strict();

export const requestAffiliationSchema = z
  .object({
    orgUserId: z.string().min(1),
  })
  .strict();
