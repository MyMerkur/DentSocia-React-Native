import { z } from "zod";
import { MICRO_COMPETENCY_TAGS } from "@dentsocia/shared-constants";
import { HUB_TYPES } from "../models/Hub";

export const createHubSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(1000).optional(),
    type: z.enum(HUB_TYPES),
    price: z.string().trim().min(1).max(20).optional(),
    specialties: z.array(z.enum(MICRO_COMPETENCY_TAGS)).optional(),
  })
  .strict()
  .refine((data) => data.type !== "paid" || Boolean(data.price), {
    message: "Ücretli Hub için fiyat belirtilmeli",
    path: ["price"],
  });

export const hubMembershipCheckoutSchema = z
  .object({
    identityNumber: z.string().trim().length(11).optional(),
    phone: z.string().trim().min(10).max(20).optional(),
    address: z.string().trim().min(1).max(300).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    country: z.string().trim().min(1).max(100).optional(),
    zipCode: z.string().trim().max(20).optional(),
  })
  .strict();

export const hubPostSchema = z
  .object({
    text: z.string().trim().min(1).max(2000),
    images: z.array(z.string().trim().min(1)).max(10).optional(),
  })
  .strict();

export const hubImageUploadUrlSchema = z
  .object({
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  })
  .strict();

export const hubFeedQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const hubDiscoverQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  specialty: z.enum(MICRO_COMPETENCY_TAGS).optional(),
});
