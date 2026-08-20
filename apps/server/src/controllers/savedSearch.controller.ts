import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth";
import { createSavedSearchSchema } from "../validators/savedSearch.validator";
import * as savedSearchService from "../services/savedSearch.service";

export async function createSavedSearchHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const input = createSavedSearchSchema.parse(req.body);
    const result = await savedSearchService.createSavedSearch(req.user!.id, input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listMySavedSearchesHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const savedSearches = await savedSearchService.listMySavedSearches(req.user!.id);
    res.status(200).json({ savedSearches });
  } catch (error) {
    next(error);
  }
}

export async function deleteSavedSearchHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    await savedSearchService.deleteSavedSearch(req.user!.id, req.params.savedSearchId!);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
