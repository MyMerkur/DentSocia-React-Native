import { Router } from "express";
import { requireFeature } from "../middlewares/requireFeature";
import { verifyCertificateHandler } from "../controllers/certificate.controller";

// No requireAuth: this is a public verification endpoint meant to be hit by anyone scanning
// a certificate's QR code (or a browser), not an authenticated DENTSOCIA user.
export const certificateRouter = Router();

certificateRouter.get("/certificates/verify/:code", requireFeature("instructorEconomy"), verifyCertificateHandler);
