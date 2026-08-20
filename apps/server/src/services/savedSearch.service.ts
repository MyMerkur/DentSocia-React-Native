import { Types } from "mongoose";
import { CANDIDATE_ROLES } from "@dentsocia/shared-constants";
import {
  createSavedSearch as createSavedSearchRecord,
  listByUser,
  countByUser,
  deleteById,
  findMatchingSavedSearches,
} from "../repositories/savedSearch.repository";
import { findUserById } from "../repositories/user.repository";
import { notifySavedSearchMatch } from "./notification.service";
import { HttpError } from "../utils/httpError";
import { logger } from "../utils/logger";
import type { SavedSearch } from "../models/SavedSearch";
import type { createSavedSearchSchema } from "../validators/savedSearch.validator";
import type { z } from "zod";

type CreateSavedSearchBody = z.infer<typeof createSavedSearchSchema>;

const MAX_SAVED_SEARCHES = 10;

function serializeSavedSearch(savedSearch: SavedSearch & { _id: Types.ObjectId }) {
  return {
    id: savedSearch._id.toString(),
    label: savedSearch.label,
    criteria: savedSearch.criteria,
    createdAt: savedSearch.createdAt,
  };
}

export async function createSavedSearch(userId: string, input: CreateSavedSearchBody) {
  const user = await findUserById(userId);
  if (!user || !(CANDIDATE_ROLES as readonly string[]).includes(user.role)) {
    throw new HttpError("Kayıtlı arama sadece bireysel hesaplar için kullanılabilir", 403);
  }

  const existingCount = await countByUser(user._id);
  if (existingCount >= MAX_SAVED_SEARCHES) {
    throw new HttpError(`En fazla ${MAX_SAVED_SEARCHES} kayıtlı arama tutabilirsiniz`, 400);
  }

  const criteria = input.criteria ?? {};
  const created = await createSavedSearchRecord(user._id, input.label ?? "", {
    location: criteria.location?.trim().toLocaleLowerCase("tr") ?? "",
    workType: criteria.workType ?? null,
    position: criteria.position ?? null,
    branch: criteria.branch ?? null,
    experienceLevel: criteria.experienceLevel ?? null,
    specialties: criteria.specialties ?? [],
  });

  return serializeSavedSearch(created);
}

export async function listMySavedSearches(userId: string) {
  const savedSearches = await listByUser(new Types.ObjectId(userId));
  return savedSearches.map(serializeSavedSearch);
}

export async function deleteSavedSearch(userId: string, savedSearchId: string) {
  const deleted = await deleteById(savedSearchId, new Types.ObjectId(userId));
  if (!deleted) {
    throw new HttpError("Kayıtlı arama bulunamadı", 404);
  }
}

interface JobForMatching {
  employerId: Types.ObjectId;
  title: string;
  location: string;
  workType?: string | null;
  position?: string | null;
  branch?: string | null;
  experienceLevel?: string | null;
  specialties: string[];
}

// job.service.ts'in createJob'ından, başarılı bir ilan oluşturmadan sonra çağrılır. Bir
// bildirim hatası ilan oluşturmayı bloklamamalı — çağıran taraf bunu try/catch ile sarmalı.
export async function notifyMatchingSavedSearches(job: JobForMatching): Promise<void> {
  const matches = await findMatchingSavedSearches(job);
  const employerIdStr = job.employerId.toString();

  await Promise.all(
    matches
      .filter((match) => match.userId.toString() !== employerIdStr)
      .map(async (match) => {
        try {
          await notifySavedSearchMatch(match.userId.toString(), job.title);
        } catch (error) {
          logger.error("savedSearch.notify.failed", {
            userId: match.userId.toString(),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
  );
}
