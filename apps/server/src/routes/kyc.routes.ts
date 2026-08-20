import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  requestUploadUrlHandler,
  confirmUploadHandler,
  listDocumentsHandler,
  listPendingDocumentsHandler,
  reviewDocumentHandler,
} from "../controllers/kyc.controller";

export const kycRouter = Router();

kycRouter.use(requireAuth);
kycRouter.post("/kyc/documents/upload-url", requestUploadUrlHandler);
kycRouter.post("/kyc/documents", confirmUploadHandler);
kycRouter.get("/kyc/documents", listDocumentsHandler);
kycRouter.get("/kyc/documents/pending", requireAdmin, listPendingDocumentsHandler);
kycRouter.post("/kyc/documents/:documentId/review", requireAdmin, reviewDocumentHandler);
