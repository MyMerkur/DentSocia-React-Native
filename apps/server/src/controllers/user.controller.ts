import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth";
import {
  updateShowcaseSchema,
  updateCareerSchema,
  avatarUploadUrlSchema,
  affiliationSchema,
  requestAffiliationSchema,
} from "../validators/user.validator";
import * as userService from "../services/user.service";
import * as affiliationRequestService from "../services/affiliationRequest.service";

export async function meHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await userService.getMe(req.user!.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateShowcaseHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const patch = updateShowcaseSchema.parse(req.body);
    const result = await userService.updateShowcase(req.user!.id, patch);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateCareerHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const patch = updateCareerSchema.parse(req.body);
    const result = await userService.updateCareer(req.user!.id, patch);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function avatarUploadUrlHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { contentType } = avatarUploadUrlSchema.parse(req.body);
    const result = await userService.requestAvatarUploadUrl(req.user!.id, contentType);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateAffiliationHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { orgUserId } = affiliationSchema.parse(req.body);
    const result = await userService.setAffiliation(req.user!.id, orgUserId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function requestAffiliationHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { orgUserId } = requestAffiliationSchema.parse(req.body);
    const result = await affiliationRequestService.requestAffiliation(req.user!.id, orgUserId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listMyAffiliationRequestsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await affiliationRequestService.listMyAffiliationRequests(req.user!.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteAccountHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    await userService.deleteAccount(req.user!.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
