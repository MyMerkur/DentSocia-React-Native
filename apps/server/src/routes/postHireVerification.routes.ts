import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  listMyPendingVerificationsHandler,
  answerVerificationHandler,
} from "../controllers/postHireVerification.controller";

// PRD v3 §8.5 — MVP kapsamı, flag'e bağlı değil.
export const postHireVerificationRouter = Router();

postHireVerificationRouter.use(requireAuth);
postHireVerificationRouter.get("/post-hire-verifications/mine", listMyPendingVerificationsHandler);
postHireVerificationRouter.post("/post-hire-verifications/:verificationId/answer", answerVerificationHandler);
