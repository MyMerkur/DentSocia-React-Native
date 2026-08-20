import { Types } from "mongoose";
import { z } from "zod";
import {
  createJob as createJobRecord,
  listOpenJobsPage,
  listJobsByEmployer,
  findJobById,
  updateJobStatus,
} from "../repositories/job.repository";
import {
  findUserById,
  consumeFreeJobPostSlotIfAvailable,
  decrementJobCreditsBalanceIfSufficient,
} from "../repositories/user.repository";
import { hasActiveSubscription } from "./subscription.service";
import { FEATURE_FLAGS } from "@dentsocia/shared-constants";
import { EMPLOYER_ROLES, type JobStatus } from "../models/Job";
import { HttpError } from "../utils/httpError";
import { resolveUserSummary, type UserSummary, type UserSummarySource } from "../utils/userSummary";
import type { createJobSchema } from "../validators/job.validator";

type CreateJobBody = z.infer<typeof createJobSchema>;

const FREE_JOB_POST_LIMIT = 3;

interface JobLike {
  _id: Types.ObjectId;
  title: string;
  description: string;
  location: string;
  specialties: string[];
  status: JobStatus;
  createdAt: Date;
  position?: string | null;
  branch?: string | null;
  workType?: string | null;
  workDays?: string[];
  workHoursStart?: string;
  workHoursEnd?: string;
  paymentModel?: string | null;
  experienceLevel?: string | null;
  hasSgk?: boolean | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryType?: string | null;
  premiumPercentage?: number | null;
  clinicAmenities?: string[];
  unitCount?: number | null;
  employeeDentistCount?: number | null;
}

function serializeJob(job: JobLike, employer: UserSummary) {
  return {
    id: job._id.toString(),
    title: job.title,
    description: job.description,
    location: job.location,
    specialties: job.specialties,
    status: job.status,
    position: job.position ?? null,
    branch: job.branch ?? null,
    workType: job.workType ?? null,
    workDays: job.workDays ?? [],
    workHoursStart: job.workHoursStart ?? "",
    workHoursEnd: job.workHoursEnd ?? "",
    paymentModel: job.paymentModel ?? null,
    experienceLevel: job.experienceLevel ?? null,
    hasSgk: job.hasSgk ?? null,
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    salaryType: job.salaryType ?? null,
    premiumPercentage: job.premiumPercentage ?? null,
    clinicAmenities: job.clinicAmenities ?? [],
    unitCount: job.unitCount ?? null,
    employeeDentistCount: job.employeeDentistCount ?? null,
    // Şeffaf ilan (PRD §8.2) — saklanmıyor, okuma anında maaş bilgisinden türetiliyor.
    isTransparent: job.salaryMin != null || job.salaryMax != null,
    employer,
    createdAt: job.createdAt,
  };
}

export async function createJob(userId: string, input: CreateJobBody) {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError("Kullanıcı bulunamadı", 404);
  }
  if (!(EMPLOYER_ROLES as readonly string[]).includes(user.role)) {
    throw new HttpError("Sadece klinik/firma/dernek hesapları ilan yayınlayabilir", 403);
  }
  if (user.kycLevel < 3) {
    throw new HttpError("İlan yayınlamak için kurumsal doğrulama (Level 3) gerekli", 403);
  }

  // Job-post quota/credit is a monetization mechanic (PRD v3 §5.2: "Faz 1'de kimseden para
  // alınmıyor") — skip it entirely while payments are off, otherwise employers would hit an
  // unpayable 402 after FREE_JOB_POST_LIMIT with no checkout route to resolve it.
  if (FEATURE_FLAGS.payments) {
    // Both the free-post quota and the paid-credit balance are consumed via atomic guarded
    // updates (findOneAndUpdate with a $lt/$gte condition), not read-then-write — this closes a
    // race where concurrent requests could each pass a stale check and over-consume the quota.
    const hasPremium = await hasActiveSubscription(userId);
    if (!hasPremium) {
      const freeSlotConsumed = await consumeFreeJobPostSlotIfAvailable(userId, FREE_JOB_POST_LIMIT);
      if (!freeSlotConsumed) {
        const creditConsumed = await decrementJobCreditsBalanceIfSufficient(userId, 1);
        if (!creditConsumed) {
          throw new HttpError(
            "İlan hakkınız kalmadı. Alakart ilan kredisi satın alın veya premium abone olun.",
            402,
          );
        }
      }
    }
  }

  const created = await createJobRecord({
    employerId: new Types.ObjectId(userId),
    title: input.title,
    description: input.description,
    location: input.location,
    specialties: input.specialties ?? [],
    position: input.position,
    branch: input.branch,
    workType: input.workType,
    workDays: input.workDays,
    workHoursStart: input.workHoursStart,
    workHoursEnd: input.workHoursEnd,
    paymentModel: input.paymentModel,
    experienceLevel: input.experienceLevel,
    hasSgk: input.hasSgk,
    salaryMin: input.salaryMin,
    salaryMax: input.salaryMax,
    salaryType: input.salaryType,
    premiumPercentage: input.premiumPercentage,
    clinicAmenities: input.clinicAmenities,
    unitCount: input.unitCount,
    employeeDentistCount: input.employeeDentistCount,
  });

  const employer = await resolveUserSummary(user);
  return serializeJob(created, employer);
}

export async function listOpenJobs(params: { cursor?: string; limit: number }) {
  const cursorDate = params.cursor ? new Date(params.cursor) : undefined;
  const { jobs, hasMore } = await listOpenJobsPage({ cursor: cursorDate, limit: params.limit });

  const items = await Promise.all(
    jobs.map(async (job) => {
      const populatedUser = job.employerId as unknown as UserSummarySource;
      const employer = await resolveUserSummary(populatedUser);
      return serializeJob(job, employer);
    }),
  );

  const last = jobs[jobs.length - 1];
  return {
    jobs: items,
    nextCursor: hasMore && last ? last.createdAt.toISOString() : null,
  };
}

export async function listMyJobs(userId: string) {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError("Kullanıcı bulunamadı", 404);
  }
  const employer = await resolveUserSummary(user);

  const jobs = await listJobsByEmployer(new Types.ObjectId(userId));
  return jobs.map((job) => serializeJob(job, employer));
}

export async function setJobStatus(userId: string, jobId: string, status: JobStatus) {
  const job = await findJobById(jobId);
  if (!job) {
    throw new HttpError("İlan bulunamadı", 404);
  }
  if (job.employerId.toString() !== userId) {
    throw new HttpError("Bu ilanı yönetme yetkiniz yok", 403);
  }

  const updated = await updateJobStatus(jobId, status);
  const user = await findUserById(userId);
  const employer = await resolveUserSummary(user!);
  return serializeJob(updated!, employer);
}
