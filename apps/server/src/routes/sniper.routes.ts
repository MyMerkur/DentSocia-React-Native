import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireFeature } from "../middlewares/requireFeature";
import {
  searchCandidatesHandler,
  unlockCandidateHandler,
  startSniperCreditCheckoutHandler,
  getSniperCreditBalanceHandler,
} from "../controllers/sniper.controller";

export const sniperRouter = Router();

sniperRouter.use(requireAuth);
sniperRouter.get("/sniper/candidates", requireFeature("candidatePoolSearch"), searchCandidatesHandler);
sniperRouter.post(
  "/sniper/candidates/:candidateId/unlock",
  requireFeature("candidatePoolSearch", "payments"),
  unlockCandidateHandler,
);
sniperRouter.post("/sniper/credits/checkout", requireFeature("payments"), startSniperCreditCheckoutHandler);
sniperRouter.get("/sniper/credits/balance", requireFeature("payments"), getSniperCreditBalanceHandler);
