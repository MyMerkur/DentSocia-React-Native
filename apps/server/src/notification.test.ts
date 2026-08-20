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

const mockOcrCreate = jest.fn();
jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ messages: { create: mockOcrCreate } })),
}));

const mockSendMail = jest.fn();
jest.mock("nodemailer", () => ({
  __esModule: true,
  default: { createTransport: jest.fn().mockImplementation(() => ({ sendMail: mockSendMail })) },
}));

function mockOcrResponse(extraction: Record<string, unknown>) {
  mockOcrCreate.mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify(extraction) }],
  });
}

let mongoServer: MongoMemoryServer;
let app: Express;

// PRD v3 §8.1 required fields — createJobSchema rejects a bare {title} payload now.
const jobDefaults = {
  description: "Yarı zamanlı çalışacak diş hekimi arıyoruz.",
  location: "İstanbul",
  position: "Diş hekimi",
  branch: "Fark etmez",
  workType: "Tam zamanlı",
  workDays: ["Pazartesi", "Salı"],
  workHoursStart: "09:00",
  workHoursEnd: "18:00",
  paymentModel: "Sabit maaş",
  experienceLevel: "1-3 yıl",
  hasSgk: true,
};

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
  mockOcrCreate.mockReset();
  mockSendMail.mockReset();
  mockGetSignedUrl.mockResolvedValue("https://example.r2.cloudflarestorage.com/presigned-url");
  mockSend.mockResolvedValue({
    Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    ContentType: "image/jpeg",
  });
});

async function registerAndLogin(email: string, role = "hekim") {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "Supersecret123", role });
  return { accessToken: response.body.accessToken as string, userId: response.body.user.id as string };
}

async function verifyOrgKyc(userId: string) {
  const { UserModel } = await import("./models/User");
  await UserModel.findByIdAndUpdate(userId, { kycLevel: 3 });
}

async function createJob(accessToken: string, employerId: string, title = "Diş Hekimi aranıyor") {
  await verifyOrgKyc(employerId);
  const response = await request(app)
    .post("/api/v1/jobs")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ title, ...jobDefaults });
  return response.body.id as string;
}

describe("Notification endpoints", () => {
  it("rejects requests without an access token", async () => {
    const response = await request(app).get("/api/v1/notifications");
    expect(response.status).toBe(401);
  });

  it("creates a kyc_status notification when a KYC document is approved (SMTP not configured, email step skipped)", async () => {
    const { accessToken, userId } = await registerAndLogin("notif-kyc@dentsocia.dev");
    mockOcrResponse({
      isLegible: true,
      extractedFullName: "Ada Lovelace",
      documentNumber: "12345",
      nameMatchesUser: true,
      confidence: "high",
      notes: "Belge net",
    });

    const uploadResponse = await request(app)
      .post("/api/v1/kyc/documents")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        documentType: "kimlik",
        storageKey: `kyc/${userId}/kimlik/fake.jpeg`,
        contentType: "image/jpeg",
        claimedFullName: "Ada Lovelace",
      });
    expect(uploadResponse.status).toBe(201);

    const response = await request(app).get("/api/v1/notifications").set("Authorization", `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    expect(response.body.notifications).toHaveLength(1);
    expect(response.body.notifications[0].type).toBe("kyc_status");
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("creates a new_application notification for the employer when someone applies", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin(
      "notif-employer@dentsocia.dev",
      "klinik",
    );
    const { accessToken: applicantToken } = await registerAndLogin("notif-applicant@dentsocia.dev", "hekim");
    const jobId = await createJob(employerToken, employerId);

    await request(app)
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({});

    const response = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${employerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.notifications.some((n: { type: string }) => n.type === "new_application")).toBe(true);
  });

  it("creates an application_status notification for the applicant when their status changes", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin(
      "notif-status-employer@dentsocia.dev",
      "firma",
    );
    const { accessToken: applicantToken } = await registerAndLogin("notif-status-applicant@dentsocia.dev", "teknisyen");
    const jobId = await createJob(employerToken, employerId);

    const applied = await request(app)
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({});

    await request(app)
      .patch(`/api/v1/applications/${applied.body.id}/status`)
      .set("Authorization", `Bearer ${employerToken}`)
      .send({ status: "accepted" });

    const response = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${applicantToken}`);

    expect(response.status).toBe(200);
    expect(response.body.notifications.some((n: { type: string }) => n.type === "application_status")).toBe(true);
  });

  it("only lets the owner mark their notification as read, and unread-count reflects it", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin(
      "notif-read-employer@dentsocia.dev",
      "dernek",
    );
    const { accessToken: applicantToken } = await registerAndLogin("notif-read-applicant@dentsocia.dev", "asistan");
    const jobId = await createJob(employerToken, employerId);

    await request(app)
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({});

    const before = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${employerToken}`);
    expect(before.body.count).toBe(1);

    const list = await request(app).get("/api/v1/notifications").set("Authorization", `Bearer ${employerToken}`);
    const notificationId = list.body.notifications[0].id;

    const deniedRead = await request(app)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${applicantToken}`);
    expect(deniedRead.status).toBe(404);

    const markRead = await request(app)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${employerToken}`);
    expect(markRead.status).toBe(200);
    expect(markRead.body.read).toBe(true);

    const after = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${employerToken}`);
    expect(after.body.count).toBe(0);
  });
});
