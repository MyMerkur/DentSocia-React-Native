import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  createSavedSearchHandler,
  listMySavedSearchesHandler,
  deleteSavedSearchHandler,
} from "../controllers/savedSearch.controller";

// PRD v3 §9.2 — MVP kapsamı, flag'e bağlı değil.
export const savedSearchRouter = Router();

savedSearchRouter.use(requireAuth);
savedSearchRouter.post("/saved-searches", createSavedSearchHandler);
savedSearchRouter.get("/saved-searches/mine", listMySavedSearchesHandler);
savedSearchRouter.delete("/saved-searches/:savedSearchId", deleteSavedSearchHandler);
