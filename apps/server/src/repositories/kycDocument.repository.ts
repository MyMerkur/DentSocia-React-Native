import { Types } from "mongoose";
import { KycDocumentModel, type KycDocumentType } from "../models/KycDocument";

export async function createKycDocument(data: {
  userId: Types.ObjectId;
  documentType: KycDocumentType;
  storageKey: string;
  contentType: string;
  claimedFullName: string;
}) {
  return KycDocumentModel.create(data);
}

export async function findApprovedByUserAndType(userId: Types.ObjectId, documentType: KycDocumentType) {
  return KycDocumentModel.findOne({ userId, documentType, status: "approved" });
}

export async function listByUser(userId: Types.ObjectId) {
  return KycDocumentModel.find({ userId }).sort({ createdAt: -1 });
}

export async function listPending() {
  return KycDocumentModel.find({ status: "pending" })
    .sort({ createdAt: 1 })
    .populate("userId", "email showcase.displayName showcase.avatarKey");
}

export async function findById(id: string) {
  return KycDocumentModel.findById(id);
}

export async function updateReview(
  id: string,
  data: { status: "approved" | "rejected"; reviewedBy: Types.ObjectId; reviewedAt: Date; reviewNote?: string },
) {
  return KycDocumentModel.findOneAndUpdate({ _id: id, status: "pending" }, data, { new: true });
}
