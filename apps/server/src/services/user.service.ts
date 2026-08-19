import { findUserById } from "../repositories/user.repository";
import { buildAvatarStorageKey, createDownloadUrl, createUploadUrl } from "../config/storage";
import { HttpError } from "../utils/httpError";
import { EMPLOYER_ROLES } from "@dentsocia/shared-constants";
import type { updateCareerSchema, updateShowcaseSchema } from "../validators/user.validator";
import type { z } from "zod";

type ShowcasePatch = z.infer<typeof updateShowcaseSchema>;
type CareerPatch = z.infer<typeof updateCareerSchema>;

export async function getMe(userId: string) {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError("Kullanıcı bulunamadı", 404);
  }

  const avatarUrl = user.showcase.avatarKey ? await createDownloadUrl(user.showcase.avatarKey) : null;

  let affiliatedOrg: { id: string; displayName: string } | null = null;
  if (user.affiliatedOrgId) {
    const org = await findUserById(user.affiliatedOrgId.toString());
    if (org) {
      affiliatedOrg = { id: org._id.toString(), displayName: org.showcase.displayName || org.email };
    }
  }

  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    kycLevel: user.kycLevel,
    showcase: {
      displayName: user.showcase.displayName,
      title: user.showcase.title,
      bio: user.showcase.bio,
      avatarUrl,
      workplace: user.showcase.workplace,
      city: user.showcase.city,
      specialties: user.showcase.specialties,
      isVerifiedOrg: (EMPLOYER_ROLES as readonly string[]).includes(user.role) && user.kycLevel >= 3,
      affiliatedOrg,
    },
    career: {
      openToWork: user.career.openToWork,
      hiddenSearch: user.career.hiddenSearch,
      desiredPositions: user.career.desiredPositions,
      experienceYears: user.career.experienceYears,
      experience: user.career.experience,
    },
  };
}

export async function updateShowcase(userId: string, patch: ShowcasePatch) {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError("Kullanıcı bulunamadı", 404);
  }

  Object.assign(user.showcase, patch);
  await user.save();

  return getMe(userId);
}

export async function updateCareer(userId: string, patch: CareerPatch) {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError("Kullanıcı bulunamadı", 404);
  }

  Object.assign(user.career, patch);
  await user.save();

  return getMe(userId);
}

// Only leaving (orgUserId: null) goes through this endpoint — joining requires the org's
// approval via affiliationRequest.service.ts, since self-service affiliation with no approval
// let anyone claim membership of any klinik/firma/dernek (ballot-stuffing, fake team members).
export async function setAffiliation(userId: string, orgUserId: string | null) {
  if (orgUserId !== null) {
    throw new HttpError("Bir kuruma bağlanmak için önce kurumdan onay almanız gerekiyor", 400);
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError("Kullanıcı bulunamadı", 404);
  }

  user.affiliatedOrgId = null;
  await user.save();

  return getMe(userId);
}

export async function requestAvatarUploadUrl(userId: string, contentType: string) {
  const storageKey = buildAvatarStorageKey(userId, contentType);
  const uploadUrl = await createUploadUrl(storageKey, contentType);
  return { uploadUrl, storageKey };
}
