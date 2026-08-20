import { Types } from "mongoose";
import { ReportModel, type ReportTargetType, type ReportReason, type ReportStatus } from "../models/Report";

interface CreateReportInput {
  reporterId: Types.ObjectId;
  targetType: ReportTargetType;
  targetId: Types.ObjectId;
  reason: ReportReason;
  details: string;
}

export async function create(data: CreateReportInput) {
  return ReportModel.create(data);
}

export async function listByStatus(status: ReportStatus) {
  return ReportModel.find({ status })
    .sort({ createdAt: 1 })
    .populate("reporterId", "email showcase.displayName showcase.avatarKey");
}

export async function resolve(
  id: string,
  data: { status: "resolved" | "dismissed"; resolvedBy: Types.ObjectId; resolvedAt: Date; resolutionNote: string },
) {
  return ReportModel.findOneAndUpdate({ _id: id, status: "open" }, data, { new: true });
}
