import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth";
import { createAnnouncementSchema, announcementFeedQuerySchema } from "../validators/announcement.validator";
import * as announcementService from "../services/announcement.service";

export async function listAnnouncementsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const query = announcementFeedQuerySchema.parse(req.query);
    const result = await announcementService.getAnnouncementFeed(query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function createAnnouncementHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = createAnnouncementSchema.parse(req.body);
    const result = await announcementService.createEditorialAnnouncement(req.user!.id, input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
