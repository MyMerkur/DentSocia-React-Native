import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";

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

  const { connectDB } = await import("./config/db");
  await connectDB();
  app = (await import("./app")).default;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
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

// FEATURE_FLAGS.payments=false — job posting is unlimited while off (see job.service.ts), so the quota tests below no longer apply
describe("Job endpoints", () => {
  it("rejects requests without an access token", async () => {
    const response = await request(app).get("/api/v1/jobs");
    expect(response.status).toBe(401);
  });

  it("rejects job creation for a non-employer role", async () => {
    const { accessToken } = await registerAndLogin("job-non-employer@dentsocia.dev", "hekim");

    const response = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Diş Hekimi aranıyor", ...jobDefaults });

    expect(response.status).toBe(403);
  });

  it("rejects job creation for an employer role without Level 3 KYC", async () => {
    const { accessToken } = await registerAndLogin("job-no-level3@dentsocia.dev", "klinik");

    const response = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Diş Hekimi aranıyor", ...jobDefaults });

    expect(response.status).toBe(403);
  });

  it("creates a job for an employer role with Level 3 KYC", async () => {
    const { accessToken, userId } = await registerAndLogin("job-employer@dentsocia.dev", "klinik");
    await verifyOrgKyc(userId);

    const response = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Diş Hekimi aranıyor", ...jobDefaults, location: "İstanbul", specialties: ["Ortodonti"] });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("open");
    expect(response.body.employer.id).toBe(userId);
  });

  it("lists only open jobs, newest first", async () => {
    const { accessToken, userId } = await registerAndLogin("job-feed@dentsocia.dev", "firma");
    await verifyOrgKyc(userId);

    await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Birinci ilan", ...jobDefaults });
    const secondResponse = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "İkinci ilan", ...jobDefaults });

    await request(app)
      .patch(`/api/v1/jobs/${secondResponse.body.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "closed" });

    const response = await request(app).get("/api/v1/jobs").set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.jobs.some((job: { title: string }) => job.title === "İkinci ilan")).toBe(false);
    expect(response.body.jobs.some((job: { title: string }) => job.title === "Birinci ilan")).toBe(true);
  });

  it("only allows the job owner to change its status", async () => {
    const { accessToken: ownerToken, userId: ownerId } = await registerAndLogin("job-owner@dentsocia.dev", "dernek");
    const { accessToken: otherToken } = await registerAndLogin("job-other@dentsocia.dev", "klinik");
    await verifyOrgKyc(ownerId);

    const created = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Asistan aranıyor", ...jobDefaults });

    const response = await request(app)
      .patch(`/api/v1/jobs/${created.body.id}/status`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ status: "closed" });

    expect(response.status).toBe(403);
  });

  it("returns the employer's own jobs regardless of status", async () => {
    const { accessToken, userId } = await registerAndLogin("job-mine@dentsocia.dev", "klinik");
    await verifyOrgKyc(userId);

    await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "İlan A", ...jobDefaults });

    const response = await request(app).get("/api/v1/jobs/mine").set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.jobs.length).toBeGreaterThanOrEqual(1);
  });

  it.skip("allows the first 3 job posts for free, then requires a credit or premium subscription", async () => {
    const { accessToken, userId } = await registerAndLogin("job-limit@dentsocia.dev", "klinik");
    await verifyOrgKyc(userId);

    for (let i = 0; i < 3; i += 1) {
      const response = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: `Ücretsiz ilan ${i + 1}`, ...jobDefaults });
      expect(response.status).toBe(201);
    }

    const fourthWithoutCredit = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Kredisiz 4. ilan", ...jobDefaults });
    expect(fourthWithoutCredit.status).toBe(402);

    const { UserModel } = await import("./models/User");
    await UserModel.findByIdAndUpdate(userId, { jobPostingCreditsBalance: 1 });

    const fourthWithCredit = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Kredili 4. ilan", ...jobDefaults });
    expect(fourthWithCredit.status).toBe(201);

    const afterCredit = await UserModel.findById(userId);
    expect(afterCredit!.jobPostingCreditsBalance).toBe(0);

    const fifthWithoutCredit = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Kredisiz 5. ilan", ...jobDefaults });
    expect(fifthWithoutCredit.status).toBe(402);
  });

  it.skip("does not allow concurrent requests to over-consume the free-post quota or credit balance", async () => {
    const { accessToken, userId } = await registerAndLogin("job-race@dentsocia.dev", "klinik");
    await verifyOrgKyc(userId);

    const { UserModel } = await import("./models/User");
    await UserModel.findByIdAndUpdate(userId, { jobPostingCreditsBalance: 2 });

    // 3 free posts + 2 credits = 5 should succeed; fire well beyond that concurrently.
    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post("/api/v1/jobs")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ title: `Yarış ilanı ${i + 1}`, ...jobDefaults }),
      ),
    );

    const successCount = responses.filter((response) => response.status === 201).length;
    const rejectedCount = responses.filter((response) => response.status === 402).length;
    expect(successCount).toBe(5);
    expect(rejectedCount).toBe(5);

    const finalUser = await UserModel.findById(userId);
    expect(finalUser!.jobPostingCreditsBalance).toBe(0);
    expect(finalUser!.freeJobPostsUsed).toBe(3);

    const { JobModel } = await import("./models/Job");
    const jobCount = await JobModel.countDocuments({ employerId: userId });
    expect(jobCount).toBe(5);
  });

  it("allows unlimited job posts with an active clinic_premium_monthly subscription", async () => {
    const { accessToken, userId } = await registerAndLogin("job-premium@dentsocia.dev", "klinik");
    await verifyOrgKyc(userId);

    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: `Ücretsiz ilan ${i + 1}`, ...jobDefaults });
    }

    const { SubscriptionModel } = await import("./models/Subscription");
    await SubscriptionModel.create({ userId, planCode: "clinic_premium_monthly", status: "active" });

    const fourth = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Premium 4. ilan", ...jobDefaults });
    expect(fourth.status).toBe(201);
  });
});
