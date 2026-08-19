import { z } from "zod";
import { MICRO_COMPETENCY_TAGS } from "@dentsocia/shared-constants";
import { JOB_STATUSES } from "../models/Job";

export const createJobSchema = z
  .object({
    title: z.string().min(3).max(150),
    description: z.string().max(3000).optional(),
    location: z.string().max(120).optional(),
    specialties: z.array(z.enum(MICRO_COMPETENCY_TAGS)).max(8).optional(),
  })
  .strict();

export const jobStatusSchema = z
  .object({
    status: z.enum(JOB_STATUSES),
  })
  .strict();

export const jobsQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
