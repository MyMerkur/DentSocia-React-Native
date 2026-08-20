import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth";
import { answerVerificationSchema } from "../validators/postHireVerification.validator";
import * as postHireVerificationService from "../services/postHireVerification.service";

export async function listMyPendingVerificationsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const verifications = await postHireVerificationService.listMyPendingVerifications(req.user!.id);
    res.status(200).json({ verifications });
  } catch (error) {
    next(error);
  }
}

export async function answerVerificationHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { answer } = answerVerificationSchema.parse(req.body);
    const result = await postHireVerificationService.answerVerification(req.user!.id, req.params.verificationId!, answer);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
