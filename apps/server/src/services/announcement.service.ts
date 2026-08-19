import { Types } from "mongoose";
import { z } from "zod";
import { createAnnouncement as createAnnouncementRecord, listAnnouncementsPage } from "../repositories/announcement.repository";
import type { AnnouncementType } from "../models/Announcement";
import type { createAnnouncementSchema } from "../validators/announcement.validator";

type CreateAnnouncementBody = z.infer<typeof createAnnouncementSchema>;

interface AnnouncementLike {
  _id: Types.ObjectId;
  type: AnnouncementType;
  title: string;
  body: string;
  createdAt: Date;
}

function serializeAnnouncement(doc: AnnouncementLike) {
  return {
    id: doc._id.toString(),
    type: doc.type,
    title: doc.title,
    body: doc.body,
    createdAt: doc.createdAt,
  };
}

// Admin'in elle yazdığı içerik (PRD §9.4: "Yönetici içerikleri"). Job/KYC/Case gibi servislerden
// otomatik "sistem olayı" yayınlama (PRD'nin "yeni ilan, yeni doğrulanmış üye" örnekleri) henüz
// bağlanmadı — bu fonksiyon çağrılmaya hazır, tetikleyiciler ayrı bir iş.
export async function createEditorialAnnouncement(adminUserId: string, input: CreateAnnouncementBody) {
  const created = await createAnnouncementRecord({
    type: "editorial",
    title: input.title,
    body: input.body,
    createdBy: new Types.ObjectId(adminUserId),
  });
  return serializeAnnouncement(created);
}

export async function getAnnouncementFeed(params: { cursor?: string; limit: number }) {
  const cursorDate = params.cursor ? new Date(params.cursor) : undefined;
  const { announcements, hasMore } = await listAnnouncementsPage({ cursor: cursorDate, limit: params.limit });

  const last = announcements[announcements.length - 1];
  return {
    announcements: announcements.map(serializeAnnouncement),
    nextCursor: hasMore && last ? last.createdAt.toISOString() : null,
  };
}
