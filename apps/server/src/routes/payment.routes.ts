import { Router, urlencoded } from "express";
import { paymentRateLimiter } from "../middlewares/rateLimiter";
import { requireFeature } from "../middlewares/requireFeature";
import {
  iyzicoCallbackHandler,
  iyzicoWebhookHandler,
  jobCreditCallbackHandler,
  hubMembershipCallbackHandler,
  duesCallbackHandler,
  eventTicketCallbackHandler,
  sniperCreditCallbackHandler,
} from "../controllers/payment.controller";

// No requireAuth: these are server-to-server / browser redirect callbacks from iyzico, not user sessions.
// requireFeature is applied per-route (not via router.use) because this router is mounted at "/"
// ahead of every other router in routes/index.ts — a blanket .use() here would 404 ALL downstream
// traffic (kyc/user/case/job/...) whenever the flag is off, not just this file's own routes.
export const paymentRouter = Router();

paymentRouter.post(
  "/payments/iyzico/callback",
  requireFeature("payments"),
  paymentRateLimiter,
  urlencoded({ extended: false }),
  iyzicoCallbackHandler,
);
paymentRouter.post("/payments/iyzico/webhook", requireFeature("payments"), paymentRateLimiter, iyzicoWebhookHandler);
paymentRouter.post(
  "/payments/iyzico/job-credit-callback",
  requireFeature("payments"),
  paymentRateLimiter,
  urlencoded({ extended: false }),
  jobCreditCallbackHandler,
);
paymentRouter.post(
  "/payments/iyzico/hub-membership-callback",
  requireFeature("payments"),
  paymentRateLimiter,
  urlencoded({ extended: false }),
  hubMembershipCallbackHandler,
);
paymentRouter.post(
  "/payments/iyzico/dues-callback",
  requireFeature("payments"),
  paymentRateLimiter,
  urlencoded({ extended: false }),
  duesCallbackHandler,
);
paymentRouter.post(
  "/payments/iyzico/event-ticket-callback",
  requireFeature("payments"),
  paymentRateLimiter,
  urlencoded({ extended: false }),
  eventTicketCallbackHandler,
);
paymentRouter.post(
  "/payments/iyzico/sniper-credit-callback",
  requireFeature("payments"),
  paymentRateLimiter,
  urlencoded({ extended: false }),
  sniperCreditCallbackHandler,
);
