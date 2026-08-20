import { Types } from "mongoose";
import { EMPLOYER_ROLES } from "@dentsocia/shared-constants";
import { UserModel } from "../models/User";
import { findUserById } from "../repositories/user.repository";
import { listJobsByEmployer } from "../repositories/job.repository";
import { listRecentCasesByUsers } from "../repositories/case.repository";
import { createDownloadUrl } from "../config/storage";
import { resolveUserSummary } from "../utils/userSummary";
import { getOrgRatingSummary } from "./clinicReview.service";
import { hasActiveSubscription } from "./subscription.service";
import { HttpError } from "../utils/httpError";

export async function searchOrgs(query: string) {
  const regex = new RegExp(query.trim(), "i");
  const orgs = await UserModel.find({
    role: { $in: EMPLOYER_ROLES },
    $or: [{ "showcase.displayName": regex }, { "showcase.workplace": regex }],
  }).limit(10);

  return orgs.map((org) => ({
    id: org._id.toString(),
    displayName: org.showcase.displayName || org.email,
    workplace: org.showcase.workplace,
  }));
}

export async function getOrgProfile(orgUserId: string) {
  const org = await findUserById(orgUserId);
  if (!org || !(EMPLOYER_ROLES as readonly string[]).includes(org.role)) {
    throw new HttpError("Kurumsal profil bulunamadı", 404);
  }

  const orgObjectId = new Types.ObjectId(orgUserId);
  const avatarUrl = org.showcase.avatarKey ? await createDownloadUrl(org.showcase.avatarKey) : null;

  const teamMembers = await UserModel.find({ affiliatedOrgId: orgObjectId }).limit(50);
  const team = await Promise.all(teamMembers.map((member) => resolveUserSummary(member)));

  const jobs = await listJobsByEmployer(orgObjectId);
  const openJobs = jobs
    .filter((job) => job.status === "open")
    .map((job) => ({
      id: job._id.toString(),
      title: job.title,
      location: job.location,
      specialties: job.specialties,
      createdAt: job.createdAt,
    }));

  const teamMemberIds = teamMembers.map((member) => member._id);
  const cases = await listRecentCasesByUsers([orgObjectId, ...teamMemberIds], 10);
  const rating = await getOrgRatingSummary(orgUserId);
  const isPremium = await hasActiveSubscription(orgUserId);
  const recentCases = await Promise.all(
    cases.map(async (caseDoc) => ({
      id: caseDoc._id.toString(),
      title: caseDoc.title,
      imageUrl: caseDoc.images[0] ? await createDownloadUrl(caseDoc.images[0].storageKey) : null,
      createdAt: caseDoc.createdAt,
    })),
  );

  return {
    id: org._id.toString(),
    role: org.role,
    displayName: org.showcase.displayName || org.email,
    title: org.showcase.title,
    bio: org.showcase.bio,
    avatarUrl,
    workplace: org.showcase.workplace,
    city: org.showcase.city,
    specialties: org.showcase.specialties,
    isVerifiedOrg: org.kycLevel >= 3,
    isPremium,
    team,
    openJobs,
    recentCases,
    rating,
  };
}
