import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { createReportHandler, listReportsHandler, resolveReportHandler } from "../controllers/report.controller";

// PRD v3 §5.1 — MVP kapsamı, flag'e bağlı değil.
export const reportRouter = Router();

reportRouter.use(requireAuth);
reportRouter.post("/reports", createReportHandler);
reportRouter.get("/reports", requireAdmin, listReportsHandler);
reportRouter.post("/reports/:reportId/resolve", requireAdmin, resolveReportHandler);
