import type { Types } from "mongoose";
import { SavedSearchModel } from "../models/SavedSearch";

interface SavedSearchCriteriaInput {
  location: string;
  workType: string | null;
  position: string | null;
  branch: string | null;
  experienceLevel: string | null;
  specialties: string[];
}

export async function createSavedSearch(userId: Types.ObjectId, label: string, criteria: SavedSearchCriteriaInput) {
  return SavedSearchModel.create({ userId, label, criteria });
}

export async function listByUser(userId: Types.ObjectId) {
  return SavedSearchModel.find({ userId }).sort({ createdAt: -1 });
}

export async function countByUser(userId: Types.ObjectId): Promise<number> {
  return SavedSearchModel.countDocuments({ userId });
}

export async function deleteById(id: string, userId: Types.ObjectId) {
  return SavedSearchModel.findOneAndDelete({ _id: id, userId });
}

interface JobForMatching {
  location: string;
  workType?: string | null;
  position?: string | null;
  branch?: string | null;
  experienceLevel?: string | null;
  specialties: string[];
}

// Her kriter alanı ya boş/null (belirtilmemiş — her ilanla eşleşir) ya da ilanın ilgili
// alanıyla birebir aynı olmalı. specialties tek yönlü kesişim: kriterde en az bir etiket
// varsa, ilanın specialties'inde o etiketlerden en az biri bulunmalı.
export async function findMatchingSavedSearches(job: JobForMatching) {
  const normalizedLocation = job.location.trim().toLocaleLowerCase("tr");
  return SavedSearchModel.find({
    $and: [
      { $or: [{ "criteria.location": "" }, { "criteria.location": normalizedLocation }] },
      { $or: [{ "criteria.workType": null }, { "criteria.workType": job.workType ?? null }] },
      { $or: [{ "criteria.position": null }, { "criteria.position": job.position ?? null }] },
      { $or: [{ "criteria.branch": null }, { "criteria.branch": job.branch ?? null }] },
      { $or: [{ "criteria.experienceLevel": null }, { "criteria.experienceLevel": job.experienceLevel ?? null }] },
      { $or: [{ "criteria.specialties": { $size: 0 } }, { "criteria.specialties": { $in: job.specialties } }] },
    ],
  });
}
