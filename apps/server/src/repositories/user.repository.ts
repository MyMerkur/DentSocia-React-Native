import { Types } from "mongoose";
import { CANDIDATE_ROLES } from "@dentsocia/shared-constants";
import { UserModel, type User } from "../models/User";

export async function findUserByEmail(email: string) {
  return UserModel.findOne({ email });
}

export async function findUserById(id: string) {
  return UserModel.findById(id);
}

export async function createUser(data: Pick<User, "email" | "passwordHash" | "role">) {
  return UserModel.create(data);
}

export async function updateBillingInfo(
  userId: string,
  billingInfo: Partial<{
    identityNumberEncrypted: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    zipCode: string;
  }>,
) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(billingInfo)) {
    set[`billingInfo.${key}`] = value;
  }
  return UserModel.findByIdAndUpdate(userId, { $set: set }, { new: true });
}

export async function incrementJobCreditsBalance(userId: string, delta: number) {
  return UserModel.findByIdAndUpdate(userId, { $inc: { jobPostingCreditsBalance: delta } }, { new: true });
}

export async function incrementSniperCreditsBalance(userId: string, delta: number) {
  return UserModel.findByIdAndUpdate(userId, { $inc: { sniperCreditsBalance: delta } }, { new: true });
}

export async function decrementSniperCreditsIfSufficient(userId: string, cost: number) {
  return UserModel.findOneAndUpdate(
    { _id: userId, sniperCreditsBalance: { $gte: cost } },
    { $inc: { sniperCreditsBalance: -cost } },
    { new: true },
  );
}

export async function decrementJobCreditsBalanceIfSufficient(userId: string, cost: number) {
  return UserModel.findOneAndUpdate(
    { _id: userId, jobPostingCreditsBalance: { $gte: cost } },
    { $inc: { jobPostingCreditsBalance: -cost } },
    { new: true },
  );
}

export async function consumeFreeJobPostSlotIfAvailable(userId: string, limit: number) {
  return UserModel.findOneAndUpdate(
    { _id: userId, freeJobPostsUsed: { $lt: limit } },
    { $inc: { freeJobPostsUsed: 1 } },
    { new: true },
  );
}

export async function findByAffiliatedOrg(orgId: string) {
  return UserModel.find({ affiliatedOrgId: new Types.ObjectId(orgId) });
}

export async function listSwipeableCandidates(params: {
  excludedCandidateIds: Types.ObjectId[];
  specialties: string[];
  limit: number;
}) {
  const query: Record<string, unknown> = {
    role: { $in: CANDIDATE_ROLES },
    "career.openToWork": true,
    "career.hiddenSearch": false,
    _id: { $nin: params.excludedCandidateIds },
  };

  if (params.specialties.length > 0) {
    query.$or = [
      { "showcase.specialties": { $in: params.specialties } },
      { "career.desiredPositions": { $in: params.specialties } },
    ];
  }

  return UserModel.find(query).sort({ createdAt: -1 }).limit(params.limit);
}

export async function searchSniperCandidates(params: {
  specialties: string[];
  city?: string;
  minExperienceYears?: number;
  maxExperienceYears?: number;
  limit: number;
}) {
  const query: Record<string, unknown> = {
    role: { $in: CANDIDATE_ROLES },
    "career.openToWork": true,
    "career.hiddenSearch": false,
  };

  if (params.specialties.length > 0) {
    query.$or = [
      { "showcase.specialties": { $in: params.specialties } },
      { "career.desiredPositions": { $in: params.specialties } },
    ];
  }

  if (params.city) {
    query["showcase.city"] = params.city;
  }

  if (params.minExperienceYears !== undefined || params.maxExperienceYears !== undefined) {
    const range: Record<string, number> = {};
    if (params.minExperienceYears !== undefined) {
      range.$gte = params.minExperienceYears;
    }
    if (params.maxExperienceYears !== undefined) {
      range.$lte = params.maxExperienceYears;
    }
    query["career.experienceYears"] = range;
  }

  return UserModel.find(query).sort({ createdAt: -1 }).limit(params.limit);
}

export async function findDiscoverableCandidateById(candidateId: string) {
  return UserModel.findOne({
    _id: candidateId,
    role: { $in: CANDIDATE_ROLES },
    "career.openToWork": true,
    "career.hiddenSearch": false,
  });
}
