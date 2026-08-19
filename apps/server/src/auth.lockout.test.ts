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

describe("Account lockout", () => {
  const credentials = { email: "lockout@dentsocia.dev", password: "Supersecret123", role: "hekim" as const };

  beforeAll(async () => {
    await request(app).post("/api/v1/auth/register").send(credentials);
  });

  it("locks the account after 5 failed login attempts", async () => {
    for (let i = 0; i < 5; i += 1) {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: credentials.email, password: "WrongPassword1" });
      expect(response.status).toBe(401);
    }

    const lockedResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: credentials.email, password: credentials.password });
    expect(lockedResponse.status).toBe(423);
  });
});
