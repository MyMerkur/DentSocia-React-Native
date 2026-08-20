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

function mockOcrResponse(extraction: Record<string, unknown>) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify(extraction) }],
  });
}

let mongoServer: MongoMemoryServer;
let app: Express;

const ADMIN_EMAIL = "kyc-admin@dentsocia.dev";

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
  process.env.ADMIN_EMAILS = ADMIN_EMAIL;

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
  mockGetSignedUrl.mockResolvedValue("https://example.r2.cloudflarestorage.com/presigned-put-url");
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

async function registerAndLoginWithRole(email: string, role: string) {
  const response = await request(app).post("/api/v1/auth/register").send({ email, password: "Supersecret123", role });
  return { accessToken: response.body.accessToken as string, userId: response.body.user.id as string };
}

async function getAdminToken() {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: ADMIN_EMAIL, password: "Supersecret123" });
  if (response.status === 200) {
    return response.body.accessToken as string;
  }
  const { accessToken } = await registerAndLogin(ADMIN_EMAIL);
  return accessToken;
}

// Testler paylaşılan bir Mongo örneğini kullandığı için kuyrukta başka testlerden kalma
// belgeler de olabilir — bu yüzden her zaman çağıranın bildiği spesifik documentId'yi
// hedef alıyoruz, "kuyruktaki ilk belge" gibi kırılgan bir varsayıma dayanmıyoruz.
async function reviewDocument(adminToken: string, documentId: string, decision: "approved" | "rejected") {
  return request(app)
    .post(`/api/v1/kyc/documents/${documentId}/review`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ decision });
}

describe("KYC endpoints", () => {
  it("rejects requests without an access token", async () => {
    const response = await request(app).get("/api/v1/kyc/documents");
    expect(response.status).toBe(401);
  });

  it("returns a pre-signed upload URL and storage key", async () => {
    const { accessToken } = await registerAndLogin("kyc-upload@dentsocia.dev");

    const response = await request(app)
      .post("/api/v1/kyc/documents/upload-url")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ documentType: "kimlik", contentType: "image/jpeg" });

    expect(response.status).toBe(200);
    expect(response.body.uploadUrl).toBe("https://example.r2.cloudflarestorage.com/presigned-put-url");
    expect(response.body.storageKey).toMatch(/^kyc\/.+\/kimlik\/.+\.jpeg$/);
  });

  it("rejects confirming an upload with a storage key that was not issued to the caller", async () => {
    const { accessToken } = await registerAndLogin("kyc-storagekey-owner@dentsocia.dev");
    const { userId: otherUserId } = await registerAndLogin("kyc-storagekey-other@dentsocia.dev");

    const response = await request(app)
      .post("/api/v1/kyc/documents")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        documentType: "kimlik",
        storageKey: `kyc/${otherUserId}/kimlik/someone-elses-upload.jpeg`,
        contentType: "image/jpeg",
        claimedFullName: "Ada Lovelace",
      });

    expect(response.status).toBe(400);
  });

  it("queues a legible, name-matching kimlik upload as pending with the AI's pre-screening signal — it does not decide", async () => {
    const { accessToken, userId } = await registerAndLogin("kyc-approve@dentsocia.dev");
    mockOcrResponse({
      isLegible: true,
      extractedFullName: "Ada Lovelace",
      documentNumber: "12345",
      nameMatchesUser: true,
      confidence: "high",
      notes: "Belge net ve ad eşleşiyor",
    });

    const response = await request(app)
      .post("/api/v1/kyc/documents")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        documentType: "kimlik",
        storageKey: `kyc/${userId}/kimlik/fake.jpeg`,
        contentType: "image/jpeg",
        claimedFullName: "Ada Lovelace",
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("pending");

    const listResponse = await request(app)
      .get("/api/v1/kyc/documents")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(listResponse.body.documents).toHaveLength(1);
    expect(listResponse.body.documents[0].status).toBe("pending");

    const profileResponse = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);
    expect(profileResponse.body.kycLevel).toBe(0);
  });

  it("still queues as pending even when the extracted name does not match the claim — AI flags it, doesn't reject it", async () => {
    const { accessToken, userId } = await registerAndLogin("kyc-mismatch@dentsocia.dev");
    mockOcrResponse({
      isLegible: true,
      extractedFullName: "Farklı İsim",
      documentNumber: "12345",
      nameMatchesUser: false,
      confidence: "high",
      notes: "Ad eşleşmiyor",
    });

    const response = await request(app)
      .post("/api/v1/kyc/documents")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        documentType: "kimlik",
        storageKey: `kyc/${userId}/kimlik/fake.jpeg`,
        contentType: "image/jpeg",
        claimedFullName: "Ada Lovelace",
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("pending");

    const adminToken = await getAdminToken();
    const pending = await request(app).get("/api/v1/kyc/documents/pending").set("Authorization", `Bearer ${adminToken}`);
    const queued = pending.body.documents.find((doc: { id: string }) => doc.id === response.body.id);
    expect(queued.aiNameMatches).toBe(false);
  });

  it("surfaces a low aiConfidence signal for an illegible document, still queued as pending", async () => {
    const { accessToken, userId } = await registerAndLogin("kyc-blurry@dentsocia.dev");
    mockOcrResponse({
      isLegible: false,
      extractedFullName: null,
      documentNumber: null,
      nameMatchesUser: false,
      confidence: "low",
      notes: "Belge okunaksız",
    });

    const response = await request(app)
      .post("/api/v1/kyc/documents")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        documentType: "kimlik",
        storageKey: `kyc/${userId}/kimlik/fake.jpeg`,
        contentType: "image/jpeg",
        claimedFullName: "Ada Lovelace",
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("pending");

    const adminToken = await getAdminToken();
    const pending = await request(app).get("/api/v1/kyc/documents/pending").set("Authorization", `Bearer ${adminToken}`);
    const queued = pending.body.documents.find((doc: { id: string }) => doc.id === response.body.id);
    expect(queued.aiConfidence).toBe("low");
  });

  it("rejects a non-admin listing or reviewing the pending queue", async () => {
    const { accessToken } = await registerAndLogin("kyc-not-admin@dentsocia.dev");

    const listResponse = await request(app).get("/api/v1/kyc/documents/pending").set("Authorization", `Bearer ${accessToken}`);
    expect(listResponse.status).toBe(403);

    const reviewResponse = await request(app)
      .post("/api/v1/kyc/documents/000000000000000000000000/review")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ decision: "approved" });
    expect(reviewResponse.status).toBe(403);
  });

  it("rejects a document via admin review and does not raise kycLevel; a second review 404s", async () => {
    const { accessToken, userId } = await registerAndLogin("kyc-admin-reject@dentsocia.dev");
    mockOcrResponse({
      isLegible: true,
      extractedFullName: "Ada Lovelace",
      documentNumber: "12345",
      nameMatchesUser: true,
      confidence: "high",
      notes: "Belge net",
    });
    const created = await request(app)
      .post("/api/v1/kyc/documents")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        documentType: "kimlik",
        storageKey: `kyc/${userId}/kimlik/fake.jpeg`,
        contentType: "image/jpeg",
        claimedFullName: "Ada Lovelace",
      });

    const adminToken = await getAdminToken();
    const rejected = await reviewDocument(adminToken, created.body.id, "rejected");
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe("rejected");

    const profileResponse = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);
    expect(profileResponse.body.kycLevel).toBe(0);

    const pendingAfter = await request(app).get("/api/v1/kyc/documents/pending").set("Authorization", `Bearer ${adminToken}`);
    expect(pendingAfter.body.documents.some((doc: { id: string }) => doc.id === created.body.id)).toBe(false);

    const secondReview = await request(app)
      .post(`/api/v1/kyc/documents/${rejected.body.id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "approved" });
    expect(secondReview.status).toBe(404);
  });

  it("rejects a diploma upload before the kimlik document is approved", async () => {
    const { accessToken, userId } = await registerAndLogin("kyc-diploma-early@dentsocia.dev");

    const response = await request(app)
      .post("/api/v1/kyc/documents")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        documentType: "diploma",
        storageKey: `kyc/${userId}/diploma/fake.jpeg`,
        contentType: "image/jpeg",
        claimedFullName: "Ada Lovelace",
      });

    expect(response.status).toBe(409);
  });

  it("approves a diploma after kimlik is approved by admin, raising kycLevel to 2", async () => {
    const { accessToken, userId } = await registerAndLogin("kyc-diploma-after@dentsocia.dev");
    const adminToken = await getAdminToken();

    mockOcrResponse({
      isLegible: true,
      extractedFullName: "Ada Lovelace",
      documentNumber: "12345",
      nameMatchesUser: true,
      confidence: "high",
      notes: "Kimlik yüklendi",
    });
    const kimlikCreated = await request(app)
      .post("/api/v1/kyc/documents")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        documentType: "kimlik",
        storageKey: `kyc/${userId}/kimlik/fake.jpeg`,
        contentType: "image/jpeg",
        claimedFullName: "Ada Lovelace",
      });
    const kimlikApproved = await reviewDocument(adminToken, kimlikCreated.body.id, "approved");
    expect(kimlikApproved.body.status).toBe("approved");

    mockOcrResponse({
      isLegible: true,
      extractedFullName: "Ada Lovelace",
      documentNumber: "DIP-1",
      nameMatchesUser: true,
      confidence: "high",
      notes: "Diploma yüklendi",
    });
    const diplomaResponse = await request(app)
      .post("/api/v1/kyc/documents")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        documentType: "diploma",
        storageKey: `kyc/${userId}/diploma/fake.jpeg`,
        contentType: "image/jpeg",
        claimedFullName: "Ada Lovelace",
      });
    expect(diplomaResponse.status).toBe(201);
    expect(diplomaResponse.body.status).toBe("pending");

    const diplomaApproved = await reviewDocument(adminToken, diplomaResponse.body.id, "approved");
    expect(diplomaApproved.status).toBe(200);

    const profileResponse = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);
    expect(profileResponse.body.kycLevel).toBe(2);
  });

  it("rejects a kurumsal_belge upload from a non-employer role", async () => {
    const { accessToken, userId } = await registerAndLoginWithRole("kyc-corp-non-employer@dentsocia.dev", "hekim");

    const response = await request(app)
      .post("/api/v1/kyc/documents")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        documentType: "kurumsal_belge",
        storageKey: `kyc/${userId}/kurumsal_belge/fake.jpeg`,
        contentType: "image/jpeg",
        claimedFullName: "DentSocia Klinik",
      });

    expect(response.status).toBe(403);
  });

  it("approves a kurumsal_belge for an employer role via admin, raising kycLevel to 3", async () => {
    const { accessToken, userId } = await registerAndLoginWithRole("kyc-corp-approve@dentsocia.dev", "klinik");
    mockOcrResponse({
      isLegible: true,
      extractedFullName: "DentSocia Klinik",
      documentNumber: "1234567890",
      nameMatchesUser: true,
      confidence: "high",
      notes: "Belge net ve kurum adı eşleşiyor",
    });

    const response = await request(app)
      .post("/api/v1/kyc/documents")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        documentType: "kurumsal_belge",
        storageKey: `kyc/${userId}/kurumsal_belge/fake.jpeg`,
        contentType: "image/jpeg",
        claimedFullName: "DentSocia Klinik",
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("pending");

    const adminToken = await getAdminToken();
    const approved = await reviewDocument(adminToken, response.body.id, "approved");
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("approved");

    const profileResponse = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);
    expect(profileResponse.body.kycLevel).toBe(3);
  });
});
