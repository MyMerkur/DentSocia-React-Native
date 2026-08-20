import { Types } from "mongoose";
import { create as createRecord, listByStatus, resolve as resolveRecord } from "../repositories/report.repository";
import { resolveUserSummary, type UserSummarySource } from "../utils/userSummary";
import { HttpError } from "../utils/httpError";
import type { ReportTargetType, ReportReason, ReportStatus, Report } from "../models/Report";

interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}

function serialize(report: Report & { _id: Types.ObjectId }) {
  return {
    id: report._id.toString(),
    targetType: report.targetType,
    targetId: report.targetId.toString(),
    reason: report.reason,
    details: report.details,
    status: report.status,
    resolutionNote: report.resolutionNote,
    createdAt: report.createdAt,
  };
}

// PRD v3 §5.1 — tek altyapı, hedefin gerçekten var olup olmadığı burada doğrulanmıyor;
// admin inceleme sırasında ilgili içeriği kendi ekranından ayrıca kontrol eder.
export async function createReport(reporterId: string, input: CreateReportInput) {
  const created = await createRecord({
    reporterId: new Types.ObjectId(reporterId),
    targetType: input.targetType,
    targetId: new Types.ObjectId(input.targetId),
    reason: input.reason,
    details: input.details ?? "",
  });
  return serialize(created);
}

export async function listReports(status: ReportStatus = "open") {
  const reports = await listByStatus(status);
  return Promise.all(
    reports.map(async (report) => ({
      ...serialize(report),
      reporter: await resolveUserSummary(report.reporterId as unknown as UserSummarySource),
    })),
  );
}

export async function resolveReport(
  adminUserId: string,
  reportId: string,
  data: { status: "resolved" | "dismissed"; resolutionNote?: string },
) {
  const updated = await resolveRecord(reportId, {
    status: data.status,
    resolvedBy: new Types.ObjectId(adminUserId),
    resolvedAt: new Date(),
    resolutionNote: data.resolutionNote ?? "",
  });
  if (!updated) {
    throw new HttpError("Şikâyet bulunamadı veya zaten çözülmüş", 404);
  }
  return serialize(updated);
}
