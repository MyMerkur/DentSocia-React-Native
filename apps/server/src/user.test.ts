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
  return response.body.accessToken as string;
}

async function registerAndLoginWithRole(email: string, role: string) {
  const response = await request(app).post("/api/v1/auth/register").send({ email, password: "Supersecret123", role });
  return { accessToken: response.body.accessToken as string, userId: response.body.user.id as string };
}

describe("User profile endpoints", () => {
  it("rejects requests without an access token", async () => {
    const response = await request(app).get("/api/v1/users/me");
    expect(response.status).toBe(401);
  });

  it("returns an empty showcase and career for a freshly registered user", async () => {
    const accessToken = await registerAndLogin("profile-default@dentsocia.dev");

    const response = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.showcase.displayName).toBe("");
    expect(response.body.showcase.specialties).toEqual([]);
    expect(response.body.showcase.avatarUrl).toBeNull();
    expect(response.body.career.openToWork).toBe(false);
    expect(response.body.career.experience).toEqual([]);
  });

  it("updates the showcase tab with valid data", async () => {
    const accessToken = await registerAndLogin("profile-showcase@dentsocia.dev");

    const response = await request(app)
      .patch("/api/v1/users/me/showcase")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayName: "Ada Lovelace",
        title: "Diş Hekimi",
        bio: "İmplantoloji odaklı çalışıyorum",
        workplace: "DentSocia Klinik",
        city: "İstanbul",
        specialties: ["İmplantoloji", "Endodonti"],
      });

    expect(response.status).toBe(200);
    expect(response.body.showcase.displayName).toBe("Ada Lovelace");
    expect(response.body.showcase.specialties).toEqual(["İmplantoloji", "Endodonti"]);
  });

  it("rejects a showcase update with an invalid specialty tag", async () => {
    const accessToken = await registerAndLogin("profile-invalid-tag@dentsocia.dev");

    const response = await request(app)
      .patch("/api/v1/users/me/showcase")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ specialties: ["Uzaylı Bilimi"] });

    expect(response.status).toBe(400);
  });

  it("resolves an avatarUrl once an avatarKey is set", async () => {
    const accessToken = await registerAndLogin("profile-avatar@dentsocia.dev");

    const response = await request(app)
      .patch("/api/v1/users/me/showcase")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ avatarKey: "avatars/some-user/photo.jpeg" });

    expect(response.status).toBe(200);
    expect(response.body.showcase.avatarUrl).toBe("https://example.r2.cloudflarestorage.com/presigned-get-url");
  });

  it("updates the career tab including the experience list", async () => {
    const accessToken = await registerAndLogin("profile-career@dentsocia.dev");

    const response = await request(app)
      .patch("/api/v1/users/me/career")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        openToWork: true,
        desiredPositions: ["Ortodonti"],
        experienceYears: 3,
        experience: [{ title: "Diş Hekimi", workplace: "DentSocia Klinik", startYear: 2021, endYear: null }],
      });

    expect(response.status).toBe(200);
    expect(response.body.career.openToWork).toBe(true);
    expect(response.body.career.experience).toHaveLength(1);
    expect(response.body.career.experience[0].title).toBe("Diş Hekimi");
  });

  it("returns a pre-signed avatar upload URL and storage key", async () => {
    const accessToken = await registerAndLogin("profile-avatar-upload@dentsocia.dev");

    const response = await request(app)
      .post("/api/v1/users/me/avatar-upload-url")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ contentType: "image/jpeg" });

    expect(response.status).toBe(200);
    expect(response.body.uploadUrl).toBe("https://example.r2.cloudflarestorage.com/presigned-put-url");
    expect(response.body.storageKey).toMatch(/^avatars\/.+\.jpeg$/);
  });

  it("shows isVerifiedOrg as false for an employer role without Level 3 KYC", async () => {
    const { accessToken } = await registerAndLoginWithRole("profile-unverified-org@dentsocia.dev", "klinik");

    const response = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.showcase.isVerifiedOrg).toBe(false);
  });

  it("shows isVerifiedOrg as true for an employer role with Level 3 KYC", async () => {
    const { accessToken, userId } = await registerAndLoginWithRole("profile-verified-org@dentsocia.dev", "firma");
    const { UserModel } = await import("./models/User");
    await UserModel.findByIdAndUpdate(userId, { kycLevel: 3 });

    const response = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.showcase.isVerifiedOrg).toBe(true);
  });

  it("rejects setting an affiliation directly — joining requires an approved request", async () => {
    const { accessToken } = await registerAndLoginWithRole("profile-affiliate@dentsocia.dev", "hekim");
    const { userId: orgId } = await registerAndLoginWithRole("profile-affiliate-org@dentsocia.dev", "klinik");

    const response = await request(app)
      .patch("/api/v1/users/me/affiliation")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orgUserId: orgId });

    expect(response.status).toBe(400);
  });

  it("rejects requesting affiliation with a non-employer-role user", async () => {
    const { accessToken } = await registerAndLoginWithRole("profile-affiliate-invalid@dentsocia.dev", "hekim");
    const { userId: otherHekimId } = await registerAndLoginWithRole("profile-affiliate-target@dentsocia.dev", "hekim");

    const response = await request(app)
      .post("/api/v1/users/me/affiliation-requests")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orgUserId: otherHekimId });

    expect(response.status).toBe(400);
  });

  it("only affiliates a user once the org approves their request", async () => {
    const { accessToken, userId } = await registerAndLoginWithRole("profile-affiliate-req@dentsocia.dev", "hekim");
    const { accessToken: orgToken, userId: orgId } = await registerAndLoginWithRole(
      "profile-affiliate-req-org@dentsocia.dev",
      "klinik",
    );

    const requestRes = await request(app)
      .post("/api/v1/users/me/affiliation-requests")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orgUserId: orgId });
    expect(requestRes.status).toBe(201);
    expect(requestRes.body.status).toBe("pending");

    const meBeforeApproval = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);
    expect(meBeforeApproval.body.showcase.affiliatedOrg).toBeNull();

    const pendingRes = await request(app)
      .get(`/api/v1/orgs/${orgId}/affiliation-requests`)
      .set("Authorization", `Bearer ${orgToken}`);
    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body).toHaveLength(1);
    expect(pendingRes.body[0].applicant.id).toBe(userId);

    const approveRes = await request(app)
      .post(`/api/v1/orgs/${orgId}/affiliation-requests/${requestRes.body.id}/approve`)
      .set("Authorization", `Bearer ${orgToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe("approved");

    const meAfterApproval = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);
    expect(meAfterApproval.body.showcase.affiliatedOrg.id).toBe(orgId);
  });

  it("rejects a non-owner reviewing another org's affiliation requests, and allows leaving without approval", async () => {
    const { accessToken } = await registerAndLoginWithRole("profile-affiliate-leave@dentsocia.dev", "hekim");
    const { accessToken: orgToken, userId: orgId } = await registerAndLoginWithRole(
      "profile-affiliate-leave-org@dentsocia.dev",
      "klinik",
    );
    const { accessToken: outsiderToken } = await registerAndLoginWithRole(
      "profile-affiliate-outsider@dentsocia.dev",
      "klinik",
    );

    const requestRes = await request(app)
      .post("/api/v1/users/me/affiliation-requests")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orgUserId: orgId });

    const outsiderApproveRes = await request(app)
      .get(`/api/v1/orgs/${orgId}/affiliation-requests`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(outsiderApproveRes.status).toBe(403);

    await request(app)
      .post(`/api/v1/orgs/${orgId}/affiliation-requests/${requestRes.body.id}/approve`)
      .set("Authorization", `Bearer ${orgToken}`);

    const leaveRes = await request(app)
      .patch("/api/v1/users/me/affiliation")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orgUserId: null });
    expect(leaveRes.status).toBe(200);
    expect(leaveRes.body.showcase.affiliatedOrg).toBeNull();
  });
});
