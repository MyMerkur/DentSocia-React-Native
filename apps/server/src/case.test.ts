import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";

const mockSend = jest.fn();
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ __type: "put", input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ __type: "get", input })),
}));

const mockGetSignedUrl = jest.fn();
jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

let mongoServer: MongoMemoryServer;
let app: Express;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.ATLAS_URI_DEV = mongoServer.getUri();
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  process.env.FIELD_ENCRYPTION_KEY = "test-field-encryption-key-32-bytes!!";
  process.env.AUTH_RATE_LIMIT_MAX = "1000";
  process.env.R2_ENDPOINT = "https://example.r2.cloudflarestorage.com";
  process.env.R2_ACCESS_KEY = "test-access-key";
  process.env.R2_SECRET_KEY = "test-secret-key";
  process.env.R2_BUCKET = "test-bucket";

  const { connectDB } = await import("./config/db");
  await connectDB();
  app = (await import("./app")).default;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(() => {
  mockSend.mockReset();
  mockGetSignedUrl.mockReset();
  mockGetSignedUrl.mockImplementation((_client, command) => {
    if (command.__type === "get") {
      return Promise.resolve("https://example.r2.cloudflarestorage.com/presigned-get-url");
    }
    return Promise.resolve("https://example.r2.cloudflarestorage.com/presigned-put-url");
  });
});

async function registerAndLogin(email: string) {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "Supersecret123", role: "hekim" });
  return { accessToken: response.body.accessToken as string, userId: response.body.user.id as string };
}

async function verifyKyc(userId: string) {
  const { UserModel } = await import("./models/User");
  await UserModel.findByIdAndUpdate(userId, { kycLevel: 1 });
}

// FEATURE_FLAGS.socialFeed=false gates the feed test below (case creation stays on — PRD MVP scope)
describe("Case endpoints", () => {
  it("rejects requests without an access token", async () => {
    const response = await request(app).get("/api/v1/cases");
    expect(response.status).toBe(401);
  });

  it("rejects case creation for a user without KYC Level 1", async () => {
    const { accessToken } = await registerAndLogin("case-no-kyc@dentsocia.dev");

    const response = await request(app)
      .post("/api/v1/cases")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "İmplant vakası",
        images: [{ storageKey: "cases/fake/photo.jpeg", stage: "after" }],
      });

    expect(response.status).toBe(403);
  });

  it("rejects case creation without any images", async () => {
    const { accessToken, userId } = await registerAndLogin("case-no-image@dentsocia.dev");
    await verifyKyc(userId);

    const response = await request(app)
      .post("/api/v1/cases")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "İmplant vakası", images: [] });

    expect(response.status).toBe(400);
  });

  it("creates a case for a KYC-verified user and returns resolved image/author URLs", async () => {
    const { accessToken, userId } = await registerAndLogin("case-create@dentsocia.dev");
    await verifyKyc(userId);

    const response = await request(app)
      .post("/api/v1/cases")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "İmplant vakası",
        description: "Tek seans implant uygulaması",
        specialties: ["İmplantoloji"],
        images: [
          { storageKey: "cases/fake/before.jpeg", stage: "before" },
          { storageKey: "cases/fake/after.jpeg", stage: "after" },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe("İmplant vakası");
    expect(response.body.images).toHaveLength(2);
    expect(response.body.images[0].url).toBe("https://example.r2.cloudflarestorage.com/presigned-get-url");
    expect(response.body.author.id).toBe(userId);
  });

  it.skip("returns the feed sorted by newest first", async () => {
    const { accessToken, userId } = await registerAndLogin("case-feed@dentsocia.dev");
    await verifyKyc(userId);

    await request(app)
      .post("/api/v1/cases")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Birinci vaka", images: [{ storageKey: "cases/fake/1.jpeg", stage: "after" }] });

    await request(app)
      .post("/api/v1/cases")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "İkinci vaka", images: [{ storageKey: "cases/fake/2.jpeg", stage: "after" }] });

    const response = await request(app).get("/api/v1/cases").set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.cases.length).toBeGreaterThanOrEqual(2);
    expect(response.body.cases[0].title).toBe("İkinci vaka");
  });

  it("returns a pre-signed image upload URL and storage key", async () => {
    const { accessToken } = await registerAndLogin("case-upload-url@dentsocia.dev");

    const response = await request(app)
      .post("/api/v1/cases/image-upload-url")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ contentType: "image/jpeg" });

    expect(response.status).toBe(200);
    expect(response.body.uploadUrl).toBe("https://example.r2.cloudflarestorage.com/presigned-put-url");
    expect(response.body.storageKey).toMatch(/^cases\/.+\.jpeg$/);
  });
});
