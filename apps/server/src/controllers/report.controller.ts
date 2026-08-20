import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth";
import { createReportSchema, resolveReportSchema, listReportsQuerySchema } from "../validators/report.validator";
import * as reportService from "../services/report.service";

export async function createReportHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = createReportSchema.parse(req.body);
    const result = await reportService.createReport(req.user!.id, input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listReportsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { status } = listReportsQuerySchema.parse(req.query);
    const reports = await reportService.listReports(status);
    res.status(200).json({ reports });
  } catch (error) {
    next(error);
  }
}

export async function resolveReportHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = resolveReportSchema.parse(req.body);
    const result = await reportService.resolveReport(req.user!.id, req.params.reportId!, body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
