import { z } from "zod";

export const createAnnouncementSchema = z
  .object({
    title: z.string().min(3).max(150),
    body: z.string().min(1).max(1000),
  })
  .strict();

export const announcementFeedQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
