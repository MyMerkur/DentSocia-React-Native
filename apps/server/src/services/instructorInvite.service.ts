import { randomUUID } from "crypto";
import { findUserById } from "../repositories/user.repository";
import { create, findByToken, markExpired, markAccepted, listAll } from "../repositories/instructorInvite.repository";
import { sendEmail, EmailNotConfiguredError } from "./email.service";
import { HttpError } from "../utils/httpError";
import { logger } from "../utils/logger";
import type { InstructorInvite } from "../models/InstructorInvite";

const INVITE_TTL_DAYS = 14;
const INSTRUCTOR_KYC_LEVEL = 4;

function serializeInvite(invite: InstructorInvite & { _id: unknown }) {
  return {
    id: (invite._id as { toString(): string }).toString(),
    email: invite.email,
    status: invite.status,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt,
    createdAt: invite.createdAt,
  };
}

export async function createInvite(adminUserId: string, email: string) {
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const token = randomUUID();
  const invite = await create({ email, invitedByAdminId: adminUserId, token, expiresAt });

  try {
    await sendEmail({
      to: email,
      subject: "DENTSOCIA Eğitmen Daveti",
      text: `DENTSOCIA'da Eğitmen statüsüne davet edildiniz. Uygulama içinde profilinizden şu daveti kodunu girerek kabul edebilirsiniz: ${token}`,
    });
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      logger.info("instructorInvite.email.skipped", { email, reason: error.message });
    } else {
      logger.error("instructorInvite.email.failed", {
        email,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return serializeInvite(invite);
}

export async function acceptInvite(userId: string, token: string) {
  const invite = await findByToken(token);
  if (!invite) {
    throw new HttpError("Davet bulunamadı", 404);
  }
  if (invite.status !== "pending") {
    throw new HttpError("Bu davet artık geçerli değil", 400);
  }
  if (invite.expiresAt < new Date()) {
    await markExpired(invite._id.toString());
    throw new HttpError("Davetin süresi dolmuş", 400);
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError("Kullanıcı bulunamadı", 404);
  }
  if (user.email !== invite.email) {
    throw new HttpError("Bu davet size ait değil", 403);
  }

  user.kycLevel = Math.max(user.kycLevel, INSTRUCTOR_KYC_LEVEL);
  await user.save();
  const updated = await markAccepted(invite._id.toString(), userId);

  return serializeInvite(updated!);
}

export async function listInvites() {
  const invites = await listAll();
  return invites.map(serializeInvite);
}
