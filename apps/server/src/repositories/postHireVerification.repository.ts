import type { Types } from "mongoose";
import { PostHireVerificationModel } from "../models/PostHireVerification";

interface CreateInput {
  jobId: Types.ObjectId;
  employerId: Types.ObjectId;
  candidateId: Types.ObjectId;
  jobTitle: string;
  dueAt: Date;
}

export async function create(data: CreateInput) {
  return PostHireVerificationModel.create(data);
}

export async function findDueUnnotified() {
  return PostHireVerificationModel.find({ status: "pending", dueAt: { $lte: new Date() }, notifiedAt: null });
}

export async function markNotified(id: Types.ObjectId) {
  return PostHireVerificationModel.updateOne({ _id: id }, { notifiedAt: new Date() });
}

export async function listPendingDueByCandidate(candidateId: Types.ObjectId) {
  return PostHireVerificationModel.find({ candidateId, status: "pending", dueAt: { $lte: new Date() } }).sort({
    dueAt: -1,
  });
}

export async function answerById(id: string, candidateId: Types.ObjectId, answer: boolean) {
  return PostHireVerificationModel.findOneAndUpdate(
    { _id: id, candidateId, status: "pending" },
    { answer, status: "answered", answeredAt: new Date() },
    { new: true },
  );
}

export async function getStatsByEmployer(employerId: Types.ObjectId) {
  const [pendingCount, yesCount, noCount] = await Promise.all([
    PostHireVerificationModel.countDocuments({ employerId, status: "pending" }),
    PostHireVerificationModel.countDocuments({ employerId, status: "answered", answer: true }),
    PostHireVerificationModel.countDocuments({ employerId, status: "answered", answer: false }),
  ]);
  return { pendingCount, yesCount, noCount };
}
