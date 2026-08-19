import type { Types } from "mongoose";
import { AnnouncementModel, type AnnouncementType } from "../models/Announcement";

interface CreateAnnouncementInput {
  type: AnnouncementType;
  title: string;
  body: string;
  createdBy: Types.ObjectId | null;
}

export async function createAnnouncement(data: CreateAnnouncementInput) {
  return AnnouncementModel.create(data);
}

export async function listAnnouncementsPage(params: { cursor?: Date; limit: number }) {
  const query = params.cursor ? { createdAt: { $lt: params.cursor } } : {};
  const announcements = await AnnouncementModel.find(query)
    .sort({ createdAt: -1 })
    .limit(params.limit + 1);

  const hasMore = announcements.length > params.limit;
  return { announcements: hasMore ? announcements.slice(0, params.limit) : announcements, hasMore };
}
