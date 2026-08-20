import { Schema, model, type InferSchemaType } from "mongoose";

export const NOTIFICATION_TYPES = [
  "kyc_status",
  "new_application",
  "application_status",
  "new_message",
  "new_match",
  "reference_request",
  "reference_written",
  "subscription_activated",
  "subscription_renewed",
  "subscription_payment_failed",
  "subscription_canceled",
  "course_enrollment",
  "certificate_issued",
  "hub_membership_activated",
  "hub_membership_renewed",
  "hub_membership_payment_failed",
  "hub_membership_canceled",
  "org_announcement",
  "org_vote_opened",
  "org_dues_activated",
  "org_dues_renewed",
  "org_dues_payment_failed",
  "org_dues_canceled",
  "event_ticket_purchased",
  "affiliation_requested",
  "affiliation_approved",
  "affiliation_rejected",
  "job_expiry_reminder",
  "post_hire_verification_due",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    body: { type: String, trim: true, maxlength: 500, default: "" },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, createdAt: -1 });

export type Notification = InferSchemaType<typeof notificationSchema>;

export const NotificationModel = model("Notification", notificationSchema);
