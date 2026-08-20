import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireFeature } from "../middlewares/requireFeature";
import {
  getJobSwipeFeedHandler,
  swipeJobHandler,
  getCandidateSwipeFeedHandler,
  swipeCandidateHandler,
  getMatchesHandler,
} from "../controllers/matching.controller";

// requireFeature applied per-route, not via router.use — see payment.routes.ts for why.
export const matchingRouter = Router();
const gate = requireFeature("swipeMatching");

matchingRouter.use(requireAuth);
matchingRouter.get("/matching/jobs/feed", gate, getJobSwipeFeedHandler);
matchingRouter.get("/matching/matches", gate, getMatchesHandler);
matchingRouter.post("/matching/jobs/:jobId/swipe", gate, swipeJobHandler);
matchingRouter.get("/matching/jobs/:jobId/candidates", gate, getCandidateSwipeFeedHandler);
matchingRouter.post("/matching/jobs/:jobId/candidates/:candidateId/swipe", gate, swipeCandidateHandler);
