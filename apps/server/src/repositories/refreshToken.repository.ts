import { Types } from "mongoose";
import { RefreshTokenModel } from "../models/RefreshToken";

export async function createRefreshToken(userId: Types.ObjectId, tokenHash: string, expiresAt: Date) {
  return RefreshTokenModel.create({ userId, tokenHash, expiresAt });
}

export async function findValidByHash(tokenHash: string) {
  return RefreshTokenModel.findOne({ tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } });
}

export async function revokeByHash(tokenHash: string) {
  return RefreshTokenModel.updateOne({ tokenHash }, { revokedAt: new Date() });
}

export async function revokeAllForUser(userId: Types.ObjectId) {
  return RefreshTokenModel.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}
