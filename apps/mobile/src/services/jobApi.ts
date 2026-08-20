import type {
  MicroCompetencyTag,
  JobPosition,
  JobBranch,
  JobWorkType,
  JobWeekday,
  JobPaymentModel,
  JobExperienceLevel,
  JobSalaryType,
  JobClinicAmenity,
} from "@dentsocia/shared-constants";
import { apiClient } from "./authApi";

export type JobStatus = "open" | "closed";
export type ApplicationStatus = "pending" | "accepted" | "rejected";

export interface JobEmployer {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface JobItem {
  id: string;
  title: string;
  description: string;
  location: string;
  specialties: MicroCompetencyTag[];
  status: JobStatus;
  position: JobPosition | null;
  branch: JobBranch | null;
  workType: JobWorkType | null;
  workDays: JobWeekday[];
  workHoursStart: string;
  workHoursEnd: string;
  paymentModel: JobPaymentModel | null;
  experienceLevel: JobExperienceLevel | null;
  hasSgk: boolean | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryType: JobSalaryType | null;
  premiumPercentage: number | null;
  clinicAmenities: JobClinicAmenity[];
  unitCount: number | null;
  employeeDentistCount: number | null;
  isTransparent: boolean;
  expiresAt: string | null;
  closeReason: "manual" | "expired" | "filled" | null;
  filledApplicationId: string | null;
  employer: JobEmployer;
  createdAt: string;
}

export interface JobsPage {
  jobs: JobItem[];
  nextCursor: string | null;
}

export interface CreateJobInput {
  title: string;
  description: string;
  location: string;
  specialties?: MicroCompetencyTag[];
  position: JobPosition;
  branch: JobBranch;
  workType: JobWorkType;
  workDays: JobWeekday[];
  workHoursStart: string;
  workHoursEnd: string;
  paymentModel: JobPaymentModel;
  experienceLevel: JobExperienceLevel;
  hasSgk: boolean;
  salaryMin?: number;
  salaryMax?: number;
  salaryType?: JobSalaryType;
  premiumPercentage?: number;
  clinicAmenities?: JobClinicAmenity[];
  unitCount?: number;
  employeeDentistCount?: number;
}

export interface MyApplicationItem {
  id: string;
  message: string;
  status: ApplicationStatus;
  createdAt: string;
  job: { id: string; title: string; employerId: string };
}

export interface JobApplicantItem {
  id: string;
  message: string;
  status: ApplicationStatus;
  createdAt: string;
  applicant: JobEmployer;
}

export async function createJob(input: CreateJobInput): Promise<JobItem> {
  const { data } = await apiClient.post<JobItem>("/api/v1/jobs", input);
  return data;
}

export async function getJobs(cursor?: string): Promise<JobsPage> {
  const { data } = await apiClient.get<JobsPage>("/api/v1/jobs", { params: cursor ? { cursor } : undefined });
  return data;
}

export async function getMyJobs(): Promise<JobItem[]> {
  const { data } = await apiClient.get<{ jobs: JobItem[] }>("/api/v1/jobs/mine");
  return data.jobs;
}

export async function updateJobStatus(jobId: string, status: JobStatus): Promise<JobItem> {
  const { data } = await apiClient.patch<JobItem>(`/api/v1/jobs/${jobId}/status`, { status });
  return data;
}

export async function extendJob(jobId: string): Promise<JobItem> {
  const { data } = await apiClient.post<JobItem>(`/api/v1/jobs/${jobId}/extend`);
  return data;
}

export async function markJobFilled(jobId: string, applicationId: string): Promise<JobItem> {
  const { data } = await apiClient.post<JobItem>(`/api/v1/jobs/${jobId}/mark-filled`, { applicationId });
  return data;
}

export async function applyToJob(jobId: string, message?: string): Promise<MyApplicationItem> {
  const { data } = await apiClient.post<MyApplicationItem>(`/api/v1/jobs/${jobId}/applications`, { message });
  return data;
}

export async function getMyApplications(): Promise<MyApplicationItem[]> {
  const { data } = await apiClient.get<{ applications: MyApplicationItem[] }>("/api/v1/applications/mine");
  return data.applications;
}

export async function getJobApplications(jobId: string): Promise<JobApplicantItem[]> {
  const { data } = await apiClient.get<{ applications: JobApplicantItem[] }>(`/api/v1/jobs/${jobId}/applications`);
  return data.applications;
}

export async function updateApplicationStatus(
  applicationId: string,
  status: "accepted" | "rejected",
): Promise<JobApplicantItem> {
  const { data } = await apiClient.patch<JobApplicantItem>(`/api/v1/applications/${applicationId}/status`, { status });
  return data;
}
