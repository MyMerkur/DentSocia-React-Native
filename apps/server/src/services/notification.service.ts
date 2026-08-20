import { Types } from "mongoose";
import {
  createNotification as createNotificationRecord,
  listByUser,
  markRead as markReadRecord,
  countUnread,
} from "../repositories/notification.repository";
import { findUserById } from "../repositories/user.repository";
import * as deviceTokenRepo from "../repositories/deviceToken.repository";
import { sendEmail, EmailNotConfiguredError } from "./email.service";
import { sendPushToUser, PushNotConfiguredError } from "./push.service";
import { logger } from "../utils/logger";
import { HttpError } from "../utils/httpError";
import type { NotificationType } from "../models/Notification";
import type { DevicePlatform } from "../models/DeviceToken";

async function createNotification(userId: string, type: NotificationType, title: string, body: string) {
  const notification = await createNotificationRecord({
    userId: new Types.ObjectId(userId),
    type,
    title,
    body,
  });

  try {
    const user = await findUserById(userId);
    if (user) {
      await sendEmail({ to: user.email, subject: title, text: body });
    }
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      logger.info("notification.email.skipped", { userId, reason: error.message });
    } else {
      logger.error("notification.email.failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    await sendPushToUser(userId, { title, body });
  } catch (error) {
    if (error instanceof PushNotConfiguredError) {
      logger.info("notification.push.skipped", { userId, reason: error.message });
    } else {
      logger.error("notification.push.failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return notification;
}

export async function registerDeviceToken(userId: string, token: string, platform: DevicePlatform): Promise<void> {
  await deviceTokenRepo.upsertToken(userId, token, platform);
}

export async function notifyKycStatusChange(userId: string, documentType: string, status: string) {
  const label = documentType === "kimlik" ? "Kimlik" : "Diploma";
  const statusText: Record<string, string> = {
    pending: "inceleme kuyruğuna alındı",
    approved: "onaylandı",
    rejected: "reddedildi",
  };
  const title = `${label} belgeniz ${statusText[status] ?? status}`;
  await createNotification(userId, "kyc_status", title, title);
}

export async function notifyNewApplication(employerId: string, jobTitle: string, applicantName: string) {
  const title = "Yeni başvuru";
  const body = `${applicantName}, "${jobTitle}" ilanınıza başvurdu`;
  await createNotification(employerId, "new_application", title, body);
}

export async function notifyApplicationStatusChange(applicantId: string, jobTitle: string, status: string) {
  const statusText = status === "accepted" ? "onaylandı" : "reddedildi";
  const title = `Başvurunuz ${statusText}`;
  const body = `"${jobTitle}" ilanına yaptığınız başvuru ${statusText}`;
  await createNotification(applicantId, "application_status", title, body);
}

export async function notifyNewMessage(recipientId: string, senderName: string) {
  const title = "Yeni mesaj";
  const body = `${senderName} size bir mesaj gönderdi`;
  await createNotification(recipientId, "new_message", title, body);
}

export async function notifyNewMatch(userId: string, counterpartName: string, jobTitle: string) {
  const title = "Yeni eşleşme";
  const body = `${counterpartName} ile "${jobTitle}" ilanı üzerinden eşleştiniz`;
  await createNotification(userId, "new_match", title, body);
}

export async function notifyReferenceRequested(authorId: string, subjectName: string) {
  const title = "Referans isteği";
  const body = `${subjectName} sizden bir referans yazmanızı istedi`;
  await createNotification(authorId, "reference_request", title, body);
}

export async function notifyReferenceWritten(subjectId: string, authorName: string) {
  const title = "Yeni referans";
  const body = `${authorName} sizin için bir referans yazdı`;
  await createNotification(subjectId, "reference_written", title, body);
}

export async function notifySubscriptionActivated(userId: string) {
  const title = "Aboneliğiniz aktif";
  const body = "Aboneliğiniz başarıyla başlatıldı, premium içeriklere erişebilirsiniz";
  await createNotification(userId, "subscription_activated", title, body);
}

export async function notifySubscriptionRenewed(userId: string) {
  const title = "Aboneliğiniz yenilendi";
  const body = "Aboneliğiniz bir sonraki dönem için başarıyla yenilendi";
  await createNotification(userId, "subscription_renewed", title, body);
}

export async function notifySubscriptionPaymentFailed(userId: string) {
  const title = "Abonelik ödemesi başarısız";
  const body = "Abonelik ödemeniz alınamadı, lütfen ödeme yönteminizi kontrol edin";
  await createNotification(userId, "subscription_payment_failed", title, body);
}

export async function notifySubscriptionCanceled(userId: string) {
  const title = "Aboneliğiniz iptal edildi";
  const body = "Aboneliğiniz iptal edildi";
  await createNotification(userId, "subscription_canceled", title, body);
}

export async function listNotifications(userId: string) {
  const notifications = await listByUser(new Types.ObjectId(userId));
  return notifications.map((notification) => ({
    id: notification._id.toString(),
    type: notification.type,
    title: notification.title,
    body: notification.body,
    read: notification.read,
    createdAt: notification.createdAt,
  }));
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const updated = await markReadRecord(notificationId, new Types.ObjectId(userId));
  if (!updated) {
    throw new HttpError("Bildirim bulunamadı", 404);
  }
  return { id: updated._id.toString(), read: updated.read };
}

export async function getUnreadCount(userId: string) {
  const count = await countUnread(new Types.ObjectId(userId));
  return { count };
}

export async function notifyCourseEnrollment(instructorId: string, courseTitle: string, participantName: string) {
  const title = "Kursunuza yeni bir katılımcı";
  const body = `${participantName}, "${courseTitle}" kursunuza katıldı`;
  await createNotification(instructorId, "course_enrollment", title, body);
}

export async function notifyCertificateIssued(userId: string, courseTitle: string) {
  const title = "Sertifikanız hazır";
  const body = `"${courseTitle}" kursunu tamamladınız, sertifikanız oluşturuldu`;
  await createNotification(userId, "certificate_issued", title, body);
}

export async function notifyHubMembershipActivated(userId: string) {
  const title = "Hub üyeliğiniz aktif";
  const body = "Hub üyeliğiniz başarıyla başlatıldı, üyelere özel içeriklere erişebilirsiniz";
  await createNotification(userId, "hub_membership_activated", title, body);
}

export async function notifyHubMembershipRenewed(userId: string) {
  const title = "Hub üyeliğiniz yenilendi";
  const body = "Hub üyeliğiniz bir sonraki dönem için başarıyla yenilendi";
  await createNotification(userId, "hub_membership_renewed", title, body);
}

export async function notifyHubMembershipPaymentFailed(userId: string) {
  const title = "Hub üyelik ödemesi başarısız";
  const body = "Hub üyelik ödemeniz alınamadı, lütfen ödeme yönteminizi kontrol edin";
  await createNotification(userId, "hub_membership_payment_failed", title, body);
}

export async function notifyHubMembershipCanceled(userId: string) {
  const title = "Hub üyeliğiniz iptal edildi";
  const body = "Hub üyeliğiniz iptal edildi";
  await createNotification(userId, "hub_membership_canceled", title, body);
}

export async function notifyOrgAnnouncement(userId: string, orgName: string, announcementTitle: string) {
  const title = `${orgName}: ${announcementTitle}`;
  const body = `${orgName} yeni bir duyuru paylaştı: "${announcementTitle}"`;
  await createNotification(userId, "org_announcement", title, body);
}

export async function notifyOrgVoteOpened(userId: string, orgName: string, question: string) {
  const title = `${orgName}: Yeni oylama`;
  const body = `${orgName} yeni bir oylama açtı: "${question}"`;
  await createNotification(userId, "org_vote_opened", title, body);
}

export async function notifyOrgDuesActivated(userId: string, orgName: string) {
  const title = "Aidat üyeliğiniz aktif";
  const body = `${orgName} aidat üyeliğiniz başarıyla başlatıldı`;
  await createNotification(userId, "org_dues_activated", title, body);
}

export async function notifyOrgDuesRenewed(userId: string, orgName: string) {
  const title = "Aidat ödemeniz yenilendi";
  const body = `${orgName} aidat ödemeniz bir sonraki dönem için başarıyla yenilendi`;
  await createNotification(userId, "org_dues_renewed", title, body);
}

export async function notifyOrgDuesPaymentFailed(userId: string, orgName: string) {
  const title = "Aidat ödemesi başarısız";
  const body = `${orgName} aidat ödemeniz alınamadı, lütfen ödeme yönteminizi kontrol edin`;
  await createNotification(userId, "org_dues_payment_failed", title, body);
}

export async function notifyOrgDuesCanceled(userId: string, orgName: string) {
  const title = "Aidat üyeliğiniz iptal edildi";
  const body = `${orgName} aidat üyeliğiniz iptal edildi`;
  await createNotification(userId, "org_dues_canceled", title, body);
}

export async function notifyEventTicketPurchased(userId: string, eventTitle: string) {
  const title = "Biletiniz hazır";
  const body = `"${eventTitle}" etkinliği için biletiniz onaylandı`;
  await createNotification(userId, "event_ticket_purchased", title, body);
}

export async function notifyAffiliationRequested(orgId: string, applicantName: string) {
  const title = "Yeni aidiyet isteği";
  const body = `${applicantName} kurumunuza katılmak için istek gönderdi`;
  await createNotification(orgId, "affiliation_requested", title, body);
}

export async function notifyAffiliationApproved(userId: string, orgName: string) {
  const title = "Aidiyet isteğiniz onaylandı";
  const body = `${orgName} kurumuna aidiyet isteğiniz onaylandı`;
  await createNotification(userId, "affiliation_approved", title, body);
}

export async function notifyAffiliationRejected(userId: string, orgName: string) {
  const title = "Aidiyet isteğiniz reddedildi";
  const body = `${orgName} kurumuna aidiyet isteğiniz reddedildi`;
  await createNotification(userId, "affiliation_rejected", title, body);
}

export async function notifyJobExpiryReminder(employerId: string, jobTitle: string) {
  const title = "İlanınız yakında kapanacak";
  const body = `"${jobTitle}" ilanınız birkaç gün içinde otomatik kapanacak, tek tıkla uzatabilirsiniz`;
  await createNotification(employerId, "job_expiry_reminder", title, body);
}

export async function notifyPostHireVerificationDue(candidateId: string, jobTitle: string) {
  const title = "İlanda belirtilen şartlar gerçekleşti mi?";
  const body = `"${jobTitle}" ilanı üzerinden işe girmiştiniz, kısa bir doğrulama sorumuzu yanıtlar mısınız?`;
  await createNotification(candidateId, "post_hire_verification_due", title, body);
}

export async function notifySavedSearchMatch(userId: string, jobTitle: string) {
  const title = "Kayıtlı aramanla eşleşen yeni ilan";
  const body = `"${jobTitle}" ilanı, kaydettiğin arama kriterleriyle eşleşiyor`;
  await createNotification(userId, "saved_search_match", title, body);
}
