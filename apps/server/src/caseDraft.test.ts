import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";

const mockSend = jest.fn();
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

const mockGetSignedUrl = jest.fn();
jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

const mockCreate = jest.fn();
jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })),
}));

function mockDraftResponse(draft: Record<string, unknown>) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify(draft) }],
  });
}

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
  process.env.ANTHROPIC_API_KEY = "test-anthropic-key";

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
  mockCreate.mockReset();
  mockSend.mockResolvedValue({
    Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    ContentType: "image/jpeg",
  });
});

async function registerAndLogin(email: string) {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "Supersecret123", role: "hekim" });
  return { accessToken: response.body.accessToken as string, userId: response.body.user.id as string };
}

async function makeInstructor(userId: string) {
  const { UserModel } = await import("./models/User");
  await UserModel.findByIdAndUpdate(userId, { kycLevel: 4 });
}

describe("Case AI draft endpoint", () => {
  it("rejects requests without an access token", async () => {
    const response = await request(app)
      .post("/api/v1/cases/ai-draft")
      .send({ storageKeys: ["cases/fake/fake.jpeg"] });
    expect(response.status).toBe(401);
  });

  it("rejects users below instructor kycLevel", async () => {
    const { accessToken } = await registerAndLogin("case-draft-non-instructor@dentsocia.dev");

    const response = await request(app)
      .post("/api/v1/cases/ai-draft")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ storageKeys: ["cases/fake/fake.jpeg"] });

    expect(response.status).toBe(403);
  });

  it("rejects an empty storageKeys array", async () => {
    const { accessToken, userId } = await registerAndLogin("case-draft-empty@dentsocia.dev");
    await makeInstructor(userId);

    const response = await request(app)
      .post("/api/v1/cases/ai-draft")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ storageKeys: [] });

    expect(response.status).toBe(400);
  });

  it("generates a case draft for an instructor from uploaded images and caption text", async () => {
    const { accessToken, userId } = await registerAndLogin("case-draft-instructor@dentsocia.dev");
    await makeInstructor(userId);

    mockDraftResponse({
      title: "Anterior Kompozit Restorasyon",
      description: "Instagram gönderisinden üretilen örnek vaka açıklaması.",
      specialties: ["Restoratif Diş Tedavisi"],
    });

    const response = await request(app)
      .post("/api/v1/cases/ai-draft")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ storageKeys: ["cases/fake/fake.jpeg"], captionText: "Harika bir vaka sonucu ✨" });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe("Anterior Kompozit Restorasyon");
    expect(response.body.specialties).toEqual(["Restoratif Diş Tedavisi"]);
  });
});
