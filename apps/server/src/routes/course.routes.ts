import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireFeature } from "../middlewares/requireFeature";
import {
  createCourseHandler,
  listCoursesHandler,
  listMyCoursesHandler,
  enrollInCourseHandler,
  listMyEnrollmentsHandler,
  listCourseEnrollmentsHandler,
  completeEnrollmentHandler,
} from "../controllers/course.controller";

// requireFeature applied per-route, not via router.use — see payment.routes.ts for why.
export const courseRouter = Router();
const gate = requireFeature("instructorEconomy");

courseRouter.use(requireAuth);
courseRouter.post("/courses", gate, createCourseHandler);
courseRouter.get("/courses", gate, listCoursesHandler);
courseRouter.get("/courses/mine", gate, listMyCoursesHandler);
courseRouter.post("/courses/:courseId/enroll", gate, enrollInCourseHandler);
courseRouter.get("/enrollments/mine", gate, listMyEnrollmentsHandler);
courseRouter.get("/courses/:courseId/enrollments", gate, listCourseEnrollmentsHandler);
courseRouter.post("/courses/:courseId/enrollments/:enrollmentId/complete", gate, completeEnrollmentHandler);
