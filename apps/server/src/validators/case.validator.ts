import { z } from "zod";
import { MICRO_COMPETENCY_TAGS } from "@dentsocia/shared-constants";
import { CASE_STAGES } from "../models/Case";

const caseImageInputSchema = z.object({
  storageKey: z.string().min(1),
  stage: z.enum(CASE_STAGES),
});

export const createCaseSchema = z
  .object({
    title: z.string().min(3).max(150),
    description: z.string().max(2000).optional(),
    specialties: z.array(z.enum(MICRO_COMPETENCY_TAGS)).max(8).optional(),
    images: z.array(caseImageInputSchema).min(1).max(9),
  })
  .strict();

export const imageUploadUrlSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png"]),
});

export const feedQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
