import { EMPLOYER_ROLES } from "@dentsocia/shared-constants";
import { findUserById } from "../repositories/user.repository";
import * as affiliationRequestRepo from "../repositories/affiliationRequest.repository";
import { resolveUserSummary, type UserSummarySource } from "../utils/userSummary";
import { notifyAffiliationRequested, notifyAffiliationApproved, notifyAffiliationRejected } from "./notification.service";
import { HttpError } from "../utils/httpError";

function serializeRequest(request: {
  _id: { toString(): string };
  orgId: unknown;
  status: string;
  createdAt: Date;
}) {
  return {
    id: request._id.toString(),
    orgId: (request.orgId as { toString(): string }).toString(),
    status: request.status,
    createdAt: request.createdAt,
  };
}

export async function requestAffiliation(userId: string, orgUserId: string) {
  const org = await findUserById(orgUserId);
  if (!org || !(EMPLOYER_ROLES as readonly string[]).includes(org.role)) {
    throw new HttpError("Geçersiz kurum", 400);
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError("Kullanıcı bulunamadı", 404);
  }
  if (user.affiliatedOrgId?.toString() === orgUserId) {
    throw new HttpError("Zaten bu kuruma bağlısınız", 409);
  }

  const existingPending = await affiliationRequestRepo.findPendingByUserAndOrg(userId, orgUserId);
  if (existingPending) {
    throw new HttpError("Bu kuruma zaten bekleyen bir isteğiniz var", 409);
  }

  const created = await affiliationRequestRepo.create(userId, orgUserId);

  const applicantName = user.showcase.displayName || user.email;
  await notifyAffiliationRequested(orgUserId, applicantName);

  return serializeRequest(created);
}

export async function listMyAffiliationRequests(userId: string) {
  const requests = await affiliationRequestRepo.listByUser(userId);
  return requests.map(serializeRequest);
}

export async function listPendingAffiliationRequests(orgId: string, requesterId: string) {
  if (orgId !== requesterId) {
    throw new HttpError("Bu kurumun isteklerini görme yetkiniz yok", 403);
  }

  const requests = await affiliationRequestRepo.listPendingByOrg(orgId);
  return Promise.all(
    requests.map(async (request) => ({
      id: request._id.toString(),
      applicant: await resolveUserSummary(request.userId as unknown as UserSummarySource),
      createdAt: request.createdAt,
    })),
  );
}

export async function approveAffiliationRequest(orgId: string, requesterId: string, requestId: string) {
  if (orgId !== requesterId) {
    throw new HttpError("Bu isteği onaylama yetkiniz yok", 403);
  }

  const request = await affiliationRequestRepo.findById(requestId);
  if (!request || request.orgId.toString() !== orgId) {
    throw new HttpError("İstek bulunamadı", 404);
  }

  const updated = await affiliationRequestRepo.updateStatus(requestId, "approved");
  if (!updated) {
    throw new HttpError("İstek zaten sonuçlandırılmış", 409);
  }

  const org = await findUserById(orgId);
  const applicant = await findUserById(request.userId.toString());
  if (applicant) {
    applicant.affiliatedOrgId = request.orgId;
    await applicant.save();
    await notifyAffiliationApproved(applicant._id.toString(), org?.showcase.displayName || org?.email || "Kurum");
  }

  return serializeRequest(updated);
}

export async function rejectAffiliationRequest(orgId: string, requesterId: string, requestId: string) {
  if (orgId !== requesterId) {
    throw new HttpError("Bu isteği reddetme yetkiniz yok", 403);
  }

  const request = await affiliationRequestRepo.findById(requestId);
  if (!request || request.orgId.toString() !== orgId) {
    throw new HttpError("İstek bulunamadı", 404);
  }

  const updated = await affiliationRequestRepo.updateStatus(requestId, "rejected");
  if (!updated) {
    throw new HttpError("İstek zaten sonuçlandırılmış", 409);
  }

  const org = await findUserById(orgId);
  await notifyAffiliationRejected(request.userId.toString(), org?.showcase.displayName || org?.email || "Kurum");

  return serializeRequest(updated);
}
