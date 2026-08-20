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

async function setOpenToWork(userId: string, hiddenSearch = false) {
  const { UserModel } = await import("./models/User");
  await UserModel.findByIdAndUpdate(userId, { "career.openToWork": true, "career.hiddenSearch": hiddenSearch });
}

async function createOpenJob(employerToken: string, title = "Diş Hekimi aranıyor") {
  const response = await request(app)
    .post("/api/v1/jobs")
    .set("Authorization", `Bearer ${employerToken}`)
    .send({ title, ...jobDefaults });
  return response.body.id as string;
}

describe("Matching endpoints", () => {
  it("rejects requests without an access token", async () => {
    const response = await request(app).get("/api/v1/matching/jobs/feed");
    expect(response.status).toBe(401);
  });

  it("excludes jobs already swiped by the candidate from the feed", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin("match-feed-employer@dentsocia.dev", "klinik");
    await verifyOrgKyc(employerId);
    const jobId = await createOpenJob(employerToken, "Swipe hariç tutma testi ilanı");

    const { accessToken: candidateToken } = await registerAndLogin("match-feed-candidate@dentsocia.dev");

    const beforeSwipe = await request(app)
      .get("/api/v1/matching/jobs/feed")
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(beforeSwipe.body.jobs.some((job: { id: string }) => job.id === jobId)).toBe(true);

    await request(app)
      .post(`/api/v1/matching/jobs/${jobId}/swipe`)
      .set("Authorization", `Bearer ${candidateToken}`)
      .send({ direction: "left" });

    const afterSwipe = await request(app)
      .get("/api/v1/matching/jobs/feed")
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(afterSwipe.body.jobs.some((job: { id: string }) => job.id === jobId)).toBe(false);
  });

  it("excludes candidates in hidden search mode from the employer's candidate feed", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin("match-hidden-employer@dentsocia.dev", "firma");
    await verifyOrgKyc(employerId);
    const jobId = await createOpenJob(employerToken, "Gizli mod testi ilanı");

    const { userId: visibleCandidateId } = await registerAndLogin("match-hidden-visible@dentsocia.dev");
    await setOpenToWork(visibleCandidateId, false);
    const { userId: hiddenCandidateId } = await registerAndLogin("match-hidden-hidden@dentsocia.dev");
    await setOpenToWork(hiddenCandidateId, true);

    const response = await request(app)
      .get(`/api/v1/matching/jobs/${jobId}/candidates`)
      .set("Authorization", `Bearer ${employerToken}`);

    expect(response.status).toBe(200);
    const ids = response.body.candidates.map((candidate: { id: string }) => candidate.id);
    expect(ids).toContain(visibleCandidateId);
    expect(ids).not.toContain(hiddenCandidateId);
  });

  it("rejects candidate feed access for a user who doesn't own the job", async () => {
    const { accessToken: ownerToken, userId: ownerId } = await registerAndLogin("match-owner@dentsocia.dev", "dernek");
    await verifyOrgKyc(ownerId);
    const jobId = await createOpenJob(ownerToken, "Sahiplik testi ilanı");

    const { accessToken: otherToken } = await registerAndLogin("match-other-employer@dentsocia.dev", "klinik");

    const response = await request(app)
      .get(`/api/v1/matching/jobs/${jobId}/candidates`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.status).toBe(403);
  });

  it("does not create a match on a one-sided right swipe", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin("match-onesided-employer@dentsocia.dev", "klinik");
    await verifyOrgKyc(employerId);
    const jobId = await createOpenJob(employerToken, "Tek taraflı swipe testi ilanı");

    const { accessToken: candidateToken } = await registerAndLogin("match-onesided-candidate@dentsocia.dev");

    const response = await request(app)
      .post(`/api/v1/matching/jobs/${jobId}/swipe`)
      .set("Authorization", `Bearer ${candidateToken}`)
      .send({ direction: "right" });

    expect(response.status).toBe(200);
    expect(response.body.matched).toBe(false);
  });

  it("rejects a direct swipe on a hidden-search candidate even when the employer already knows their id", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin(
      "match-direct-hidden-employer@dentsocia.dev",
      "klinik",
    );
    await verifyOrgKyc(employerId);
    const jobId = await createOpenJob(employerToken, "Doğrudan swipe gizlilik testi ilanı");

    const { userId: hiddenCandidateId } = await registerAndLogin("match-direct-hidden-candidate@dentsocia.dev");
    await setOpenToWork(hiddenCandidateId, true);

    const response = await request(app)
      .post(`/api/v1/matching/jobs/${jobId}/candidates/${hiddenCandidateId}/swipe`)
      .set("Authorization", `Bearer ${employerToken}`)
      .send({ direction: "right" });

    expect(response.status).toBe(404);
  });

  it("creates a match and an inbox thread when both sides swipe right", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin("match-mutual-employer@dentsocia.dev", "firma");
    await verifyOrgKyc(employerId);
    const jobId = await createOpenJob(employerToken, "Karşılıklı eşleşme testi ilanı");

    const { accessToken: candidateToken, userId: candidateId } = await registerAndLogin("match-mutual-candidate@dentsocia.dev");
    await setOpenToWork(candidateId, false);

    const candidateSwipe = await request(app)
      .post(`/api/v1/matching/jobs/${jobId}/swipe`)
      .set("Authorization", `Bearer ${candidateToken}`)
      .send({ direction: "right" });
    expect(candidateSwipe.body.matched).toBe(false);

    const employerSwipe = await request(app)
      .post(`/api/v1/matching/jobs/${jobId}/candidates/${candidateId}/swipe`)
      .set("Authorization", `Bearer ${employerToken}`)
      .send({ direction: "right" });

    expect(employerSwipe.status).toBe(200);
    expect(employerSwipe.body.matched).toBe(true);
    expect(employerSwipe.body.match.jobId).toBe(jobId);

    const candidateMatches = await request(app)
      .get("/api/v1/matching/matches")
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(candidateMatches.body.matches).toHaveLength(1);
    expect(candidateMatches.body.matches[0].job.id).toBe(jobId);

    const threads = await request(app)
      .get("/api/v1/inbox/threads")
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(threads.body.threads.some((thread: { id: string }) => thread.id === employerSwipe.body.match.threadId)).toBe(true);
  });
});
