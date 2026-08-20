import type { Request, Response, NextFunction } from "express";
import { FEATURE_FLAGS, type FeatureFlag } from "@dentsocia/shared-constants";

// 404, not 403 — a flag-gated route shouldn't even reveal it exists (matches
// certificateRouter's fully-public-or-nothing posture, not an auth boundary).
export function requireFeature(...flags: FeatureFlag[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (flags.every((flag) => FEATURE_FLAGS[flag])) {
      next();
      return;
    }
    res.status(404).json({ message: "Not found" });
  };
}
