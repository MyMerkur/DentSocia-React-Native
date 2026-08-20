import { EMPLOYER_ROLES } from "@dentsocia/shared-constants";
import { findUserById } from "../repositories/user.repository";
import { upsertReview, listByOrg } from "../repositories/clinicReview.repository";
import { resolveUserSummary, type UserSummarySource } from "../utils/userSummary";
import { HttpError } from "../utils/httpError";

async function requireOrg(orgId: string) {
  const org = await findUserById(orgId);
  if (!org || !(EMPLOYER_ROLES as readonly string[]).includes(org.role)) {
    throw new HttpError("Kurumsal profil bulunamadı", 404);
  }
  return org;
}

export async function rateOrg(authorId: string, orgId: string, rating: number, comment: string) {
  await requireOrg(orgId);
  if (authorId === orgId) {
    throw new HttpError("Kendi kurumunuzu değerlendiremezsiniz", 400);
  }

  const review = await upsertReview({ orgId, authorId, rating, comment });
  return { id: review._id.toString(), rating: review.rating, comment: review.comment, createdAt: review.createdAt };
}

export async function getOrgRatingSummary(orgId: string) {
  const reviews = await listByOrg(orgId);
  if (reviews.length === 0) {
    return { average: 0, count: 0 };
  }
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return { average: Math.round((total / reviews.length) * 10) / 10, count: reviews.length };
}

export async function listOrgReviews(orgId: string) {
  const reviews = await listByOrg(orgId);
  return Promise.all(
    reviews.map(async (review) => {
      const author = await resolveUserSummary(review.authorId as unknown as UserSummarySource);
      return {
        id: review._id.toString(),
        rating: review.rating,
        comment: review.comment,
        author,
        createdAt: review.createdAt,
      };
    }),
  );
}
