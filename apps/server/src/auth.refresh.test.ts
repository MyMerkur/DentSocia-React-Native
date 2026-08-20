import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";

let mongoServer: MongoMemoryServer;
let app: Express;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.ATLAS_URI_DEV = mongoServer.getUri();
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  process.env.FIELD_ENCRYPTION_KEY = "test-field-encryption-key-32-bytes!!";
  process.env.AUTH_RATE_LIMIT_MAX = "1000";

  const { connectDB } = await import("./config/db");
  await connectDB();
  app = (await import("./app")).default;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("Refresh token rotation and logout", () => {
  const credentials = { email: "refresh@dentsocia.dev", password: "Supersecret123", role: "hekim" as const };

  it("rotates the refresh token and rejects the old one on reuse", async () => {
    const registerResponse = await request(app).post("/api/v1/auth/register").send(credentials);
    const originalRefreshToken = registerResponse.body.refreshToken as string;

    const refreshResponse = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: originalRefreshToken });
    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.refreshToken).toBeDefined();
    expect(refreshResponse.body.refreshToken).not.toBe(originalRefreshToken);

    const reuseResponse = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: originalRefreshToken });
    expect(reuseResponse.status).toBe(401);
  });

  it("invalidates the refresh token after logout", async () => {
    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: credentials.email, password: credentials.password });
    const refreshToken = loginResponse.body.refreshToken as string;

    const logoutResponse = await request(app).post("/api/v1/auth/logout").send({ refreshToken });
    expect(logoutResponse.status).toBe(204);

    const refreshAfterLogout = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
  });
});
