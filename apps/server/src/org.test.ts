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
  mockGetSignedUrl.mockResolvedValue("https://example.r2.cloudflarestorage.com/presigned-url");
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

describe("Org endpoints", () => {
  it("rejects requests without an access token", async () => {
    const response = await request(app).get("/api/v1/orgs/search");
    expect(response.status).toBe(401);
  });

  it("returns 404 for a non-existent org", async () => {
    const { accessToken } = await registerAndLogin("org-viewer@dentsocia.dev");

    const response = await request(app)
      .get("/api/v1/orgs/6a00000000000000000000aa")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
  });

  it("returns 404 for a user whose role is not an employer role", async () => {
    const { accessToken } = await registerAndLogin("org-viewer-2@dentsocia.dev");
    const { userId: hekimId } = await registerAndLogin("org-not-employer@dentsocia.dev", "hekim");

    const response = await request(app)
      .get(`/api/v1/orgs/${hekimId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
  });

  it("finds orgs by display name via search", async () => {
    const { accessToken: viewerToken } = await registerAndLogin("org-searcher@dentsocia.dev");
    const { accessToken: orgToken } = await registerAndLogin("org-searchable@dentsocia.dev", "klinik");

    await request(app)
      .patch("/api/v1/users/me/showcase")
      .set("Authorization", `Bearer ${orgToken}`)
      .send({ displayName: "DentSocia Diş Kliniği" });

    const response = await request(app)
      .get("/api/v1/orgs/search?q=DentSocia")
      .set("Authorization", `Bearer ${viewerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.orgs.some((org: { displayName: string }) => org.displayName === "DentSocia Diş Kliniği")).toBe(
      true,
    );
  });

  it("returns showcase info, verification, open jobs, team and recent cases for an org", async () => {
    const { accessToken: orgToken, userId: orgId } = await registerAndLogin("org-full@dentsocia.dev", "klinik");
    await verifyOrgKyc(orgId);
    await request(app)
      .patch("/api/v1/users/me/showcase")
      .set("Authorization", `Bearer ${orgToken}`)
      .send({ displayName: "Tam Vitrin Klinik" });

    const openJobId = await createJob(orgToken, orgId, "Açık ilan");
    const closedJobResponse = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${orgToken}`)
      .send({ title: "Kapalı ilan", ...jobDefaults });
    await request(app)
      .patch(`/api/v1/jobs/${closedJobResponse.body.id}/status`)
      .set("Authorization", `Bearer ${orgToken}`)
      .send({ status: "closed" });

    const { accessToken: memberToken, userId: memberId } = await registerAndLogin(
      "org-team-member@dentsocia.dev",
      "hekim",
    );
    const { UserModel } = await import("./models/User");
    await UserModel.findByIdAndUpdate(memberId, { affiliatedOrgId: orgId });

    await verifyOrgKyc(memberId);
    await request(app)
      .post("/api/v1/cases")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ title: "Ekip üyesinin vakası", images: [{ storageKey: "cases/fake/1.jpeg", stage: "after" }] });

    const { accessToken: viewerToken } = await registerAndLogin("org-viewer-3@dentsocia.dev");
    const response = await request(app).get(`/api/v1/orgs/${orgId}`).set("Authorization", `Bearer ${viewerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.displayName).toBe("Tam Vitrin Klinik");
    expect(response.body.isVerifiedOrg).toBe(true);
    expect(response.body.isPremium).toBe(false);
    expect(response.body.openJobs).toHaveLength(1);
    expect(response.body.openJobs[0].id).toBe(openJobId);
    expect(response.body.team).toHaveLength(1);
    expect(response.body.team[0].id).toBe(memberId);
    expect(response.body.recentCases).toHaveLength(1);
    expect(response.body.recentCases[0].title).toBe("Ekip üyesinin vakası");
  });
});
