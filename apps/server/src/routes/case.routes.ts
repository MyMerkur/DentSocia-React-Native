import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireFeature } from "../middlewares/requireFeature";
import { aiDraftRateLimiter } from "../middlewares/rateLimiter";
import {
  imageUploadUrlHandler,
  createCaseHandler,
  feedHandler,
  generateCaseDraftHandler,
} from "../controllers/case.controller";

export const caseRouter = Router();

caseRouter.use(requireAuth);
// Vaka portfolyosu (yükleme) PRD MVP kapsamında — her zaman açık. Feed listesi (GET) ve
// Instagram'dan AI taslak üretimi (ai-draft) ayrı flag'ler arkasında.
caseRouter.post("/cases/image-upload-url", imageUploadUrlHandler);
caseRouter.post("/cases/ai-draft", requireFeature("instagramImport"), aiDraftRateLimiter, generateCaseDraftHandler);
caseRouter.post("/cases", createCaseHandler);
caseRouter.get("/cases", requireFeature("socialFeed"), feedHandler);
