import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireFeature } from "../middlewares/requireFeature";
import {
  searchOrgsHandler,
  getOrgProfileHandler,
  rateOrgHandler,
  listOrgReviewsHandler,
  createAnnouncementHandler,
  listAnnouncementsHandler,
  createVoteHandler,
  listVotesHandler,
  castBallotHandler,
  closeVoteHandler,
  createDuesPlanHandler,
  getDuesPlanHandler,
  startDuesCheckoutHandler,
  cancelDuesSubscriptionHandler,
  getMyDuesStatusHandler,
  listDuesSubscribersHandler,
  listAffiliationRequestsHandler,
  approveAffiliationRequestHandler,
  rejectAffiliationRequestHandler,
} from "../controllers/org.controller";

export const orgRouter = Router();

orgRouter.use(requireAuth);
// Temel klinik/kurum profili + kuruma bağlılık — PRD MVP kapsamında (§5.1 "Klinik profili"), her zaman açık.
orgRouter.get("/orgs/search", searchOrgsHandler);
orgRouter.get("/orgs/:userId", getOrgProfileHandler);
orgRouter.get("/orgs/:orgId/affiliation-requests", listAffiliationRequestsHandler);
orgRouter.post("/orgs/:orgId/affiliation-requests/:requestId/approve", approveAffiliationRequestHandler);
orgRouter.post("/orgs/:orgId/affiliation-requests/:requestId/reject", rejectAffiliationRequestHandler);
// PRD v3 §5.2: "İşveren puanlama/yorum ... Planlanmıyor"
orgRouter.post("/orgs/:orgId/reviews", requireFeature("orgReviews"), rateOrgHandler);
orgRouter.get("/orgs/:orgId/reviews", requireFeature("orgReviews"), listOrgReviewsHandler);
// PRD v3 Faz 3 kapsam: "dernek ve kurum sayfaları" (duyuru + oylama)
orgRouter.post("/orgs/:orgId/announcements", requireFeature("associationTools"), createAnnouncementHandler);
orgRouter.get("/orgs/:orgId/announcements", requireFeature("associationTools"), listAnnouncementsHandler);
orgRouter.post("/orgs/:orgId/votes", requireFeature("associationTools"), createVoteHandler);
orgRouter.get("/orgs/:orgId/votes", requireFeature("associationTools"), listVotesHandler);
orgRouter.post("/orgs/votes/:voteId/ballot", requireFeature("associationTools"), castBallotHandler);
orgRouter.post("/orgs/votes/:voteId/close", requireFeature("associationTools"), closeVoteHandler);
// PRD v3 Faz 4 kapsam: "dernek aidat tahsilatı"
orgRouter.post("/orgs/:orgId/dues-plan", requireFeature("associationDues"), createDuesPlanHandler);
orgRouter.get("/orgs/:orgId/dues-plan", requireFeature("associationDues"), getDuesPlanHandler);
orgRouter.post("/orgs/:orgId/dues/checkout", requireFeature("associationDues", "payments"), startDuesCheckoutHandler);
orgRouter.post("/orgs/:orgId/dues/cancel", requireFeature("associationDues"), cancelDuesSubscriptionHandler);
orgRouter.get("/orgs/:orgId/dues/mine", requireFeature("associationDues"), getMyDuesStatusHandler);
orgRouter.get("/orgs/:orgId/dues/subscribers", requireFeature("associationDues"), listDuesSubscribersHandler);
