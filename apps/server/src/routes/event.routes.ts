import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireFeature } from "../middlewares/requireFeature";
import {
  createEventHandler,
  listUpcomingEventsHandler,
  listMyOrganizedEventsHandler,
  listEventAttendeesHandler,
  startTicketCheckoutHandler,
  listMyTicketsHandler,
  checkInTicketHandler,
} from "../controllers/event.controller";

// requireFeature applied per-route, not via router.use — see payment.routes.ts for why
// (sniperRouter is mounted after this one).
export const eventRouter = Router();
const gate = requireFeature("eventTicketing");

eventRouter.use(requireAuth);
eventRouter.post("/events", gate, createEventHandler);
eventRouter.get("/events", gate, listUpcomingEventsHandler);
eventRouter.get("/events/mine", gate, listMyOrganizedEventsHandler);
eventRouter.get("/events/tickets/mine", gate, listMyTicketsHandler);
eventRouter.post("/events/tickets/check-in", gate, checkInTicketHandler);
eventRouter.get("/events/:eventId/attendees", gate, listEventAttendeesHandler);
eventRouter.post(
  "/events/:eventId/tickets/checkout",
  requireFeature("eventTicketing", "payments"),
  startTicketCheckoutHandler,
);
