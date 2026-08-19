import { EMPLOYER_ROLES } from "@dentsocia/shared-constants";
import { findUserById } from "../repositories/user.repository";
import { createDownloadUrl } from "../config/storage";
import { listPublicReferences } from "./reference.service";
import { HttpError } from "../utils/httpError";

export async function getPublicProfile(userId: string) {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError("Kullanıcı bulunamadı", 404);
  }
  if ((EMPLOYER_ROLES as readonly string[]).includes(user.role)) {
    throw new HttpError("Kurumsal hesaplar için /orgs/:userId ucunu kullanın", 404);
  }

  const avatarUrl = user.showcase.avatarKey ? await createDownloadUrl(user.showcase.avatarKey) : null;
  const references = await listPublicReferences(userId);

  return {
    id: user._id.toString(),
    displayName: user.showcase.displayName || user.email,
    title: user.showcase.title,
    bio: user.showcase.bio,
    avatarUrl,
    workplace: user.showcase.workplace,
    city: user.showcase.city,
    specialties: user.showcase.specialties,
    references,
  };
}
