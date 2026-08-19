import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireFeature } from "../middlewares/requireFeature";
import { instagramRateLimiter } from "../middlewares/rateLimiter";
import {
  connectHandler,
  callbackHandler,
  statusHandler,
  mediaHandler,
  disconnectHandler,
} from "../controllers/instagram.controller";

// No blanket requireAuth here: /instagram/oauth/callback is a public redirect target hit by
// Meta's servers (no auth header). Every other route below applies requireAuth explicitly per-route.
// requireFeature applied per-route too, not via router.use — see payment.routes.ts for why
// (this router is mounted early in routes/index.ts, ahead of most others).
export const instagramRouter = Router();
const gate = requireFeature("instagramImport");

instagramRouter.get("/instagram/connect", gate, requireAuth, connectHandler);
instagramRouter.get("/instagram/oauth/callback", gate, instagramRateLimiter, callbackHandler);
instagramRouter.get("/instagram/status", gate, requireAuth, statusHandler);
instagramRouter.get("/instagram/media", gate, requireAuth, mediaHandler);
instagramRouter.delete("/instagram/connection", gate, requireAuth, disconnectHandler);
