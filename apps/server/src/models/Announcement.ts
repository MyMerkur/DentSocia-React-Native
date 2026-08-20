import { Schema, model, type InferSchemaType } from "mongoose";

// PRD v3 §9.4 — salt okunur duyuru akışı. "system": job/kyc/case gibi servislerden yayınlanacak
// olaylar (henüz otomatik tetiklenmiyor, bkz. announcement.service.ts). "editorial": admin'in
// elle yazdığı içerik (KVKK hatırlatması, sözleşme maddesi vb.).
export const ANNOUNCEMENT_TYPES = ["system", "editorial"] as const;
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

const announcementSchema = new Schema(
  {
    type: { type: String, enum: ANNOUNCEMENT_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

announcementSchema.index({ createdAt: -1 });

export type Announcement = InferSchemaType<typeof announcementSchema>;

export const AnnouncementModel = model("Announcement", announcementSchema);
