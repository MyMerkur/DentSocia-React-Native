import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireFeature } from "../middlewares/requireFeature";
import { paymentRateLimiter } from "../middlewares/rateLimiter";
import { startCheckoutHandler, getStatusHandler, cancelSubscriptionHandler } from "../controllers/subscription.controller";

// requireFeature applied per-route, not via router.use — this router isn't the last one mounted
// in routes/index.ts, and a blanket .use() would 404 every downstream router too (see payment.routes.ts).
export const subscriptionRouter = Router();

subscriptionRouter.use(requireAuth);
subscriptionRouter.post("/subscriptions/checkout", requireFeature("payments"), paymentRateLimiter, startCheckoutHandler);
subscriptionRouter.get("/subscriptions/status", requireFeature("payments"), getStatusHandler);
subscriptionRouter.post("/subscriptions/cancel", requireFeature("payments"), cancelSubscriptionHandler);
