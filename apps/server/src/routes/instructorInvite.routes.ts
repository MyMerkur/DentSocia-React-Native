import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { requireFeature } from "../middlewares/requireFeature";
import {
  createInviteHandler,
  listInvitesHandler,
  acceptInviteHandler,
} from "../controllers/instructorInvite.controller";

// requireFeature applied per-route, not via router.use — see payment.routes.ts for why.
export const instructorInviteRouter = Router();

instructorInviteRouter.use(requireAuth);
instructorInviteRouter.post(
  "/admin/instructor-invites",
  requireFeature("instructorEconomy"),
  requireAdmin,
  createInviteHandler,
);
instructorInviteRouter.get(
  "/admin/instructor-invites",
  requireFeature("instructorEconomy"),
  requireAdmin,
  listInvitesHandler,
);
instructorInviteRouter.post(
  "/instructor-invites/:token/accept",
  requireFeature("instructorEconomy"),
  acceptInviteHandler,
);
