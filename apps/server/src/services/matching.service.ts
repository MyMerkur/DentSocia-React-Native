import { Types } from "mongoose";
import { EMPLOYER_ROLES } from "@dentsocia/shared-constants";
import { findJobById, listOpenJobsExcluding } from "../repositories/job.repository";
import { findUserById, listSwipeableCandidates } from "../repositories/user.repository";
import {
  upsertSwipe,
  findRightSwipe,
  listSwipedJobIds,
  listSwipedCandidateIds,
} from "../repositories/swipe.repository";
import { findOrCreateMatch, listMatchesByUser } from "../repositories/match.repository";
import { startOrGetThread } from "./inbox.service";
import { notifyNewMatch } from "./notification.service";
import { resolveUserSummary, type UserSummarySource } from "../utils/userSummary";
import { HttpError } from "../utils/httpError";
import type { SwipeDirection } from "../models/JobSwipe";

async function serializeJobCard(job: {
  _id: Types.ObjectId;
  title: string;
  description: string;
  location: string;
  specialties: string[];
  employerId: unknown;
  createdAt: Date;
}) {
  const employer = await resolveUserSummary(job.employerId as unknown as UserSummarySource);
  return {
    id: job._id.toString(),
    title: job.title,
    description: job.description,
    location: job.location,
    specialties: job.specialties,
    employer,
    createdAt: job.createdAt,
  };
}

async function serializeCandidateCard(candidate: {
  _id: Types.ObjectId;
  email: string;
  showcase: { displayName: string; avatarKey?: string | null };
  career: { desiredPositions: string[]; experienceYears: number | null };
}) {
  const summary = await resolveUserSummary(candidate);
  return {
    ...summary,
    desiredPositions: candidate.career.desiredPositions,
    experienceYears: candidate.career.experienceYears,
  };
}

async function completeMatchIfMutual(jobId: string, candidateId: string, employerId: string) {
  const thread = await startOrGetThread(candidateId, employerId, { type: "job", id: jobId });
  const match = await findOrCreateMatch({ jobId, candidateId, employerId, threadId: thread.id });

  const candidate = await findUserById(candidateId);
  const employer = await findUserById(employerId);
  const job = await findJobById(jobId);
  if (candidate && employer && job) {
    await notifyNewMatch(candidateId, employer.showcase.displayName || employer.email, job.title);
    await notifyNewMatch(employerId, candidate.showcase.displayName || candidate.email, job.title);
  }

  return { id: match._id.toString(), jobId, threadId: thread.id };
}

export async function getJobSwipeFeed(userId: string, limit = 20) {
  const excludedJobIds = (await listSwipedJobIds(userId)) as Types.ObjectId[];
  const jobs = await listOpenJobsExcluding(excludedJobIds, limit);
  return { jobs: await Promise.all(jobs.map((job) => serializeJobCard(job as unknown as Parameters<typeof serializeJobCard>[0]))) };
}

export async function swipeJob(userId: string, jobId: string, direction: SwipeDirection) {
  const job = await findJobById(jobId);
  if (!job || job.status !== "open") {
    throw new HttpError("İlan bulunamadı", 404);
  }

  await upsertSwipe({ jobId, candidateId: userId, swipedBy: "candidate", direction });

  if (direction === "right") {
    const employerSwipe = await findRightSwipe(jobId, userId, "employer");
    if (employerSwipe) {
      const match = await completeMatchIfMutual(jobId, userId, job.employerId.toString());
      return { matched: true, match };
    }
  }

  return { matched: false };
}

export async function getCandidateSwipeFeed(userId: string, jobId: string, limit = 20) {
  const job = await findJobById(jobId);
  if (!job) {
    throw new HttpError("İlan bulunamadı", 404);
  }
  if (job.employerId.toString() !== userId) {
    throw new HttpError("Bu ilanın adaylarını görme yetkiniz yok", 403);
  }

  const excludedCandidateIds = (await listSwipedCandidateIds(jobId)) as Types.ObjectId[];
  const candidates = await listSwipeableCandidates({
    excludedCandidateIds,
    specialties: job.specialties,
    limit,
  });

  return {
    candidates: await Promise.all(
      candidates.map((candidate) => serializeCandidateCard(candidate as unknown as Parameters<typeof serializeCandidateCard>[0])),
    ),
  };
}

export async function swipeCandidate(userId: string, jobId: string, candidateId: string, direction: SwipeDirection) {
  const job = await findJobById(jobId);
  if (!job) {
    throw new HttpError("İlan bulunamadı", 404);
  }
  if (job.employerId.toString() !== userId) {
    throw new HttpError("Bu ilan için swipe yapma yetkiniz yok", 403);
  }

  const candidate = await findUserById(candidateId);
  if (!candidate || (EMPLOYER_ROLES as readonly string[]).includes(candidate.role)) {
    throw new HttpError("Aday bulunamadı", 404);
  }
  // Same discoverability gate as the browse feed (listSwipeableCandidates) — swiping a
  // candidateId obtained elsewhere (case author, another job's applicant list) must not bypass
  // their openToWork/hiddenSearch privacy choice. 404, not 403, so existence isn't leaked.
  if (!candidate.career.openToWork || candidate.career.hiddenSearch) {
    throw new HttpError("Aday bulunamadı", 404);
  }

  await upsertSwipe({ jobId, candidateId, swipedBy: "employer", direction });

  if (direction === "right") {
    const candidateSwipe = await findRightSwipe(jobId, candidateId, "candidate");
    if (candidateSwipe) {
      const match = await completeMatchIfMutual(jobId, candidateId, userId);
      return { matched: true, match };
    }
  }

  return { matched: false };
}

export async function getMatches(userId: string) {
  const matches = await listMatchesByUser(userId);

  return Promise.all(
    matches.map(async (match) => {
      const isCandidate = match.candidateId.toString() === userId;
      const counterpartId = isCandidate ? match.employerId.toString() : match.candidateId.toString();
      const counterpartUser = await findUserById(counterpartId);
      const counterpart = counterpartUser
        ? await resolveUserSummary(counterpartUser)
        : { id: counterpartId, displayName: "Bilinmeyen kullanıcı", avatarUrl: null };
      const job = match.jobId as unknown as { _id: Types.ObjectId; title: string };

      return {
        id: match._id.toString(),
        job: { id: job._id.toString(), title: job.title },
        counterpart,
        counterpartRole: isCandidate ? "employer" : "candidate",
        threadId: match.threadId.toString(),
        createdAt: match.createdAt,
      };
    }),
  );
}
