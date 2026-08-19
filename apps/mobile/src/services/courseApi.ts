import type { MicroCompetencyTag } from "@dentsocia/shared-constants";
import { apiClient } from "./authApi";

export interface CourseInstructor {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CourseItem {
  id: string;
  title: string;
  description: string;
  specialties: MicroCompetencyTag[];
  instructor: CourseInstructor;
  createdAt: string;
}

export interface CertificateSummary {
  verificationCode: string;
  issuedAt: string;
  qrCodeDataUrl: string;
  verificationUrl: string;
}

export interface EnrollmentItem {
  id: string;
  status: "enrolled" | "completed";
  completedAt: string | null;
  createdAt: string;
  course: { id: string; title: string };
  certificate: CertificateSummary | null;
}

export interface CourseParticipant {
  id: string;
  status: "enrolled" | "completed";
  completedAt: string | null;
  createdAt: string;
  participant: CourseInstructor;
}

export interface CreateCourseInput {
  title: string;
  description?: string;
  specialties?: MicroCompetencyTag[];
}

export async function createCourse(input: CreateCourseInput): Promise<CourseItem> {
  const { data } = await apiClient.post<CourseItem>("/api/v1/courses", input);
  return data;
}

export async function listCourses(): Promise<CourseItem[]> {
  const { data } = await apiClient.get<{ courses: CourseItem[] }>("/api/v1/courses");
  return data.courses;
}

export async function listMyCourses(): Promise<CourseItem[]> {
  const { data } = await apiClient.get<{ courses: CourseItem[] }>("/api/v1/courses/mine");
  return data.courses;
}

export async function enrollInCourse(courseId: string): Promise<void> {
  await apiClient.post(`/api/v1/courses/${courseId}/enroll`);
}

export async function listMyEnrollments(): Promise<EnrollmentItem[]> {
  const { data } = await apiClient.get<{ enrollments: EnrollmentItem[] }>("/api/v1/enrollments/mine");
  return data.enrollments;
}

export async function listCourseEnrollments(courseId: string): Promise<CourseParticipant[]> {
  const { data } = await apiClient.get<{ enrollments: CourseParticipant[] }>(
    `/api/v1/courses/${courseId}/enrollments`,
  );
  return data.enrollments;
}

export async function completeEnrollment(courseId: string, enrollmentId: string): Promise<void> {
  await apiClient.post(`/api/v1/courses/${courseId}/enrollments/${enrollmentId}/complete`);
}
