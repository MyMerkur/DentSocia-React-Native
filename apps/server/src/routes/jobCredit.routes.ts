import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireFeature } from "../middlewares/requireFeature";
import { paymentRateLimiter } from "../middlewares/rateLimiter";
import { startJobCreditCheckoutHandler, getJobCreditBalanceHandler } from "../controllers/jobCredit.controller";

// requireFeature applied per-route, not via router.use — see payment.routes.ts for why.
export const jobCreditRouter = Router();

jobCreditRouter.use(requireAuth);
jobCreditRouter.post("/job-credits/checkout", requireFeature("payments"), paymentRateLimiter, startJobCreditCheckoutHandler);
jobCreditRouter.get("/job-credits/balance", requireFeature("payments"), getJobCreditBalanceHandler);
