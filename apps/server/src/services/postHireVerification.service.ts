import { Types } from "mongoose";
import {
  create as createRecord,
  findDueUnnotified,
  markNotified,
  listPendingDueByCandidate,
  answerById,
  getStatsByEmployer,
} from "../repositories/postHireVerification.repository";
import { notifyPostHireVerificationDue } from "./notification.service";
import { POST_HIRE_VERIFICATION_DELAY_MS } from "../models/PostHireVerification";
import { HttpError } from "../utils/httpError";
import { logger } from "../utils/logger";
import type { PostHireVerification } from "../models/PostHireVerification";

function serialize(item: PostHireVerification & { _id: Types.ObjectId }) {
  return {
    id: item._id.toString(),
    jobId: item.jobId.toString(),
    jobTitle: item.jobTitle,
    dueAt: item.dueAt,
    status: item.status,
    answer: item.answer,
    answeredAt: item.answeredAt,
  };
}

interface JobForScheduling {
  _id: Types.ObjectId;
  employerId: Types.ObjectId;
  title: string;
}

// job.service.ts'in markJobFilled'ından çağrılır.
export async function scheduleVerification(job: JobForScheduling, candidateId: string) {
  await createRecord({
    jobId: job._id,
    employerId: job.employerId,
    candidateId: new Types.ObjectId(candidateId),
    jobTitle: job.title,
    dueAt: new Date(Date.now() + POST_HIRE_VERIFICATION_DELAY_MS),
  });
}

export async function listMyPendingVerifications(userId: string) {
  const items = await listPendingDueByCandidate(new Types.ObjectId(userId));
  return items.map(serialize);
}

export async function answerVerification(userId: string, id: string, answer: boolean) {
  const updated = await answerById(id, new Types.ObjectId(userId), answer);
  if (!updated) {
    throw new HttpError("Doğrulama bulunamadı", 404);
  }
  return serialize(updated);
}

export async function getEmployerStats(employerId: string) {
  return getStatsByEmployer(new Types.ObjectId(employerId));
}

// scheduledTasks/postHireVerification.task.ts'ten çağrılır — cron'dan ayrı export edildi ki
// testler zamanlamayı beklemeden doğrudan çağırabilsin.
export async function runPostHireVerificationSweep(): Promise<void> {
  const due = await findDueUnnotified();
  for (const item of due) {
    try {
      await notifyPostHireVerificationDue(item.candidateId.toString(), item.jobTitle);
      await markNotified(item._id);
    } catch (error) {
      logger.error("postHireVerification.sweep.failed", {
        id: item._id.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
