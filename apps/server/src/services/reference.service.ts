import { CANDIDATE_ROLES } from "@dentsocia/shared-constants";
import { findUserById } from "../repositories/user.repository";
import {
  createRequest,
  createDirect,
  findById,
  markWritten,
  setVisibility as setVisibilityRecord,
  listIncoming,
  listBySubject,
} from "../repositories/reference.repository";
import { notifyReferenceRequested, notifyReferenceWritten } from "./notification.service";
import { resolveUserSummary } from "../utils/userSummary";
import { HttpError } from "../utils/httpError";
import type { Reference } from "../models/Reference";

async function requireCandidateSubject(subjectId: string) {
  const subject = await findUserById(subjectId);
  if (!subject || !(CANDIDATE_ROLES as readonly string[]).includes(subject.role)) {
    throw new HttpError("Referans sadece bireysel hesaplar için verilebilir", 400);
  }
  return subject;
}

function serializeReference(reference: Reference & { _id: unknown }, counterpart: Awaited<ReturnType<typeof resolveUserSummary>>) {
  return {
    id: (reference._id as { toString(): string }).toString(),
    status: reference.status,
    relationship: reference.relationship,
    body: reference.body,
    counterpart,
    createdAt: reference.createdAt,
  };
}

export async function requestReference(subjectId: string, authorId: string) {
  await requireCandidateSubject(subjectId);
  if (authorId === subjectId) {
    throw new HttpError("Kendinizden referans isteyemezsiniz", 400);
  }
  const author = await findUserById(authorId);
  if (!author) {
    throw new HttpError("Kullanıcı bulunamadı", 404);
  }

  const reference = await createRequest(subjectId, authorId);
  const subject = await findUserById(subjectId);
  await notifyReferenceRequested(authorId, subject!.showcase.displayName || subject!.email);

  const counterpart = await resolveUserSummary(author);
  return serializeReference(reference, counterpart);
}

export async function writeReference(authorId: string, subjectId: string, relationship: string, body: string) {
  await requireCandidateSubject(subjectId);
  if (authorId === subjectId) {
    throw new HttpError("Kendiniz için referans yazamazsınız", 400);
  }

  const reference = await createDirect({ subjectId, authorId, relationship, body });
  const author = await findUserById(authorId);
  await notifyReferenceWritten(subjectId, author!.showcase.displayName || author!.email);

  const counterpart = await resolveUserSummary(author!);
  return serializeReference(reference, counterpart);
}

export async function fulfillReferenceRequest(authorId: string, referenceId: string, relationship: string, body: string) {
  const reference = await findById(referenceId);
  if (!reference) {
    throw new HttpError("Referans isteği bulunamadı", 404);
  }
  if (reference.authorId.toString() !== authorId) {
    throw new HttpError("Bu isteği doldurma yetkiniz yok", 403);
  }
  if (reference.status !== "pending") {
    throw new HttpError("Bu istek zaten dolduruldu", 400);
  }

  const updated = await markWritten(referenceId, { relationship, body });
  const author = await findUserById(authorId);
  await notifyReferenceWritten(reference.subjectId.toString(), author!.showcase.displayName || author!.email);

  const counterpart = await resolveUserSummary(author!);
  return serializeReference(updated!, counterpart);
}

export async function listIncomingRequests(authorId: string) {
  const references = await listIncoming(authorId);
  return Promise.all(
    references.map(async (reference) => {
      const subject = await findUserById(reference.subjectId.toString());
      const counterpart = subject
        ? await resolveUserSummary(subject)
        : { id: reference.subjectId.toString(), displayName: "Bilinmeyen kullanıcı", avatarUrl: null };
      return serializeReference(reference, counterpart);
    }),
  );
}

export async function listMyReferences(subjectId: string) {
  const references = await listBySubject(subjectId, ["written", "hidden"]);
  return Promise.all(
    references.map(async (reference) => {
      const author = await findUserById(reference.authorId.toString());
      const counterpart = author
        ? await resolveUserSummary(author)
        : { id: reference.authorId.toString(), displayName: "Bilinmeyen kullanıcı", avatarUrl: null };
      return serializeReference(reference, counterpart);
    }),
  );
}

export async function setVisibility(subjectId: string, referenceId: string, hidden: boolean) {
  const reference = await findById(referenceId);
  if (!reference) {
    throw new HttpError("Referans bulunamadı", 404);
  }
  if (reference.subjectId.toString() !== subjectId) {
    throw new HttpError("Bu referansı yönetme yetkiniz yok", 403);
  }
  if (reference.status === "pending") {
    throw new HttpError("Henüz yazılmamış bir referansın görünürlüğü değiştirilemez", 400);
  }

  const updated = await setVisibilityRecord(referenceId, hidden ? "hidden" : "written");
  const author = await findUserById(reference.authorId.toString());
  const counterpart = author
    ? await resolveUserSummary(author)
    : { id: reference.authorId.toString(), displayName: "Bilinmeyen kullanıcı", avatarUrl: null };
  return serializeReference(updated!, counterpart);
}

export async function listPublicReferences(subjectId: string) {
  const references = await listBySubject(subjectId, ["written"]);
  return Promise.all(
    references.map(async (reference) => {
      const author = await findUserById(reference.authorId.toString());
      const counterpart = author
        ? await resolveUserSummary(author)
        : { id: reference.authorId.toString(), displayName: "Bilinmeyen kullanıcı", avatarUrl: null };
      return serializeReference(reference, counterpart);
    }),
  );
}
