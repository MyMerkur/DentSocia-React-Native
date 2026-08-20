import { z } from "zod";
import {
  MICRO_COMPETENCY_TAGS,
  JOB_POSITIONS,
  JOB_BRANCHES,
  JOB_WORK_TYPES,
  JOB_EXPERIENCE_LEVELS,
} from "@dentsocia/shared-constants";

const savedSearchCriteriaSchema = z
  .object({
    location: z.string().max(120).optional(),
    workType: z.enum(JOB_WORK_TYPES).optional(),
    position: z.enum(JOB_POSITIONS).optional(),
    branch: z.enum(JOB_BRANCHES).optional(),
    experienceLevel: z.enum(JOB_EXPERIENCE_LEVELS).optional(),
    specialties: z.array(z.enum(MICRO_COMPETENCY_TAGS)).max(8).optional(),
  })
  .strict();

export const createSavedSearchSchema = z
  .object({
    label: z.string().max(100).optional(),
    criteria: savedSearchCriteriaSchema.optional(),
  })
  .strict();
