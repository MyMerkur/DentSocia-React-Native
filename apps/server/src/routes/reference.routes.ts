import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireFeature } from "../middlewares/requireFeature";
import {
  requestReferenceHandler,
  writeReferenceHandler,
  fulfillReferenceHandler,
  listIncomingRequestsHandler,
  listMyReferencesHandler,
  setReferenceVisibilityHandler,
} from "../controllers/reference.controller";

// requireFeature applied per-route, not via router.use — see payment.routes.ts for why.
export const referenceRouter = Router();
const gate = requireFeature("references");

referenceRouter.use(requireAuth);
referenceRouter.get("/references/requests/incoming", gate, listIncomingRequestsHandler);
referenceRouter.post("/references/requests", gate, requestReferenceHandler);
referenceRouter.post("/references/requests/:referenceId/fulfill", gate, fulfillReferenceHandler);
referenceRouter.get("/references/me", gate, listMyReferencesHandler);
referenceRouter.post("/references", gate, writeReferenceHandler);
referenceRouter.patch("/references/:referenceId/visibility", gate, setReferenceVisibilityHandler);
