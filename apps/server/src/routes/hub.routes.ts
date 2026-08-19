import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireFeature } from "../middlewares/requireFeature";
import {
  createHubHandler,
  discoverHubsHandler,
  listMyHubsHandler,
  listManagedHubsHandler,
  getHubDetailHandler,
  joinFreeHubHandler,
  startHubMembershipCheckoutHandler,
  leaveHubHandler,
  hubPostImageUploadUrlHandler,
  createHubPostHandler,
  listHubFeedHandler,
} from "../controllers/hub.controller";

// requireFeature applied per-route, not via router.use — see payment.routes.ts for why
// (eventRouter and sniperRouter are mounted after this one).
export const hubRouter = Router();
const gate = requireFeature("communityHubs");

hubRouter.use(requireAuth);
hubRouter.post("/hubs", gate, createHubHandler);
hubRouter.get("/hubs", gate, discoverHubsHandler);
hubRouter.get("/hubs/mine", gate, listMyHubsHandler);
hubRouter.get("/hubs/managed", gate, listManagedHubsHandler);
hubRouter.get("/hubs/:hubId", gate, getHubDetailHandler);
hubRouter.post("/hubs/:hubId/join", gate, joinFreeHubHandler);
hubRouter.post(
  "/hubs/:hubId/membership/checkout",
  requireFeature("communityHubs", "payments"),
  startHubMembershipCheckoutHandler,
);
hubRouter.post("/hubs/:hubId/leave", gate, leaveHubHandler);
hubRouter.post("/hubs/:hubId/posts/image-upload-url", gate, hubPostImageUploadUrlHandler);
hubRouter.post("/hubs/:hubId/posts", gate, createHubPostHandler);
hubRouter.get("/hubs/:hubId/posts", gate, listHubFeedHandler);
