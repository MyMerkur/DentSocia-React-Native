import { z } from "zod";

export const answerVerificationSchema = z
  .object({
    answer: z.boolean(),
  })
  .strict();
