import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { listAnnouncementsHandler, createAnnouncementHandler } from "../controllers/announcement.controller";

// PRD v3 §9.4 — salt okunur duyuru akışı, MVP'nin varsayılan Ana Sayfa deneyimi. Flag'e bağlı
// değil, her zaman mount edilir (bkz. FEATURE_FLAGS.socialFeed'in kapattığı GET /cases).
export const announcementRouter = Router();

announcementRouter.use(requireAuth);
announcementRouter.get("/announcements", listAnnouncementsHandler);
announcementRouter.post("/announcements", requireAdmin, createAnnouncementHandler);
