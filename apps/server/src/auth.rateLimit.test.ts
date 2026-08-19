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
  process.env.AUTH_RATE_LIMIT_MAX = "3";

  const { connectDB } = await import("./config/db");
  await connectDB();
  app = (await import("./app")).default;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("Auth rate limiting", () => {
  it("returns 429 after exceeding the configured limit", async () => {
    const payload = { email: "ratelimit@dentsocia.dev", password: "WrongPassword1" };

    for (let i = 0; i < 3; i += 1) {
      const response = await request(app).post("/api/v1/auth/login").send(payload);
      expect(response.status).not.toBe(429);
    }

    const limitedResponse = await request(app).post("/api/v1/auth/login").send(payload);
    expect(limitedResponse.status).toBe(429);
  });
});
