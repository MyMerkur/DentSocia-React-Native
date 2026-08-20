import type { Types } from "mongoose";
import { JobModel, type JobStatus } from "../models/Job";

interface CreateJobInput {
  employerId: Types.ObjectId;
  title: string;
  description: string;
  location: string;
  specialties: string[];
  position?: string;
  branch?: string;
  workType?: string;
  workDays?: string[];
  workHoursStart?: string;
  workHoursEnd?: string;
  paymentModel?: string;
  experienceLevel?: string;
  hasSgk?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  salaryType?: string;
  premiumPercentage?: number;
  clinicAmenities?: string[];
  unitCount?: number;
  employeeDentistCount?: number;
}

export async function createJob(data: CreateJobInput) {
  return JobModel.create(data);
}

export async function listOpenJobsPage(params: { cursor?: Date; limit: number }) {
  const query: Record<string, unknown> = { status: "open" };
  if (params.cursor) {
    query.createdAt = { $lt: params.cursor };
  }
  const jobs = await JobModel.find(query)
    .sort({ createdAt: -1 })
    .limit(params.limit + 1)
    .populate("employerId", "email showcase.displayName showcase.avatarKey");

  const hasMore = jobs.length > params.limit;
  return { jobs: hasMore ? jobs.slice(0, params.limit) : jobs, hasMore };
}

export async function listJobsByEmployer(employerId: Types.ObjectId) {
  return JobModel.find({ employerId }).sort({ createdAt: -1 }).limit(100);
}

export async function listOpenJobsExcluding(excludedJobIds: Types.ObjectId[], limit: number) {
  return JobModel.find({ status: "open", _id: { $nin: excludedJobIds } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("employerId", "email showcase.displayName showcase.avatarKey");
}

export async function findJobById(id: string) {
  return JobModel.findById(id);
}

export async function updateJobStatus(id: string, status: JobStatus) {
  return JobModel.findByIdAndUpdate(id, { status }, { new: true });
}

export async function countByEmployer(employerId: Types.ObjectId): Promise<number> {
  return JobModel.countDocuments({ employerId });
}
