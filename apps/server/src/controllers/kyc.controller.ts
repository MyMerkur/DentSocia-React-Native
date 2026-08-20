import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth";
import { uploadUrlSchema, confirmUploadSchema, reviewDocumentSchema } from "../validators/kyc.validator";
import * as kycService from "../services/kyc.service";

export async function requestUploadUrlHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { documentType, contentType } = uploadUrlSchema.parse(req.body);
    const result = await kycService.requestUploadUrl(req.user!.id, documentType, contentType);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function confirmUploadHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const body = confirmUploadSchema.parse(req.body);
    const document = await kycService.confirmUpload(req.user!.id, body);
    res.status(201).json({
      id: document._id.toString(),
      documentType: document.documentType,
      status: document.status,
    });
  } catch (error) {
    next(error);
  }
}

export async function listDocumentsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const documents = await kycService.listUserDocuments(req.user!.id);
    res.status(200).json({
      documents: documents.map((doc) => ({
        id: doc._id.toString(),
        documentType: doc.documentType,
        status: doc.status,
        createdAt: doc.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function listPendingDocumentsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const documents = await kycService.listPendingDocuments();
    res.status(200).json({ documents });
  } catch (error) {
    next(error);
  }
}

export async function reviewDocumentHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { decision, note } = reviewDocumentSchema.parse(req.body);
    const result = await kycService.reviewDocument(req.user!.id, req.params.documentId!, decision, note);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
