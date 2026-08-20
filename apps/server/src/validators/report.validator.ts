import { z } from "zod";
import { REPORT_TARGET_TYPES, REPORT_REASONS } from "../models/Report";

export const createReportSchema = z
  .object({
    targetType: z.enum(REPORT_TARGET_TYPES),
    targetId: z.string().min(1),
    reason: z.enum(REPORT_REASONS),
    details: z.string().max(500).optional(),
  })
  .strict();

export const resolveReportSchema = z
  .object({
    status: z.enum(["resolved", "dismissed"]),
    resolutionNote: z.string().max(500).optional(),
  })
  .strict();

export const listReportsQuerySchema = z.object({
  status: z.enum(["open", "resolved", "dismissed"]).default("open"),
});
