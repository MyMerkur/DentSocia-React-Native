import { z } from "zod";
import { MICRO_COMPETENCY_TAGS } from "@dentsocia/shared-constants";

export const createCourseSchema = z
  .object({
    title: z.string().min(3).max(150),
    description: z.string().max(3000).optional(),
    specialties: z.array(z.enum(MICRO_COMPETENCY_TAGS)).max(8).optional(),
  })
  .strict();
