import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";

let mongoServer: MongoMemoryServer;
let app: Express;

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

async function createJob(accessToken: string, title = "Diş Hekimi aranıyor") {
  const response = await request(app)
    .post("/api/v1/jobs")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ title, ...jobDefaults });
  return response.body.id as string;
}

describe("Job lifecycle endpoints (§8.3)", () => {
  it("only lets the job owner extend an open job", async () => {
    const { accessToken: ownerToken, userId: ownerId } = await registerAndLogin("lifecycle-extend-owner@dentsocia.dev", "klinik");
    const { accessToken: otherToken } = await registerAndLogin("lifecycle-extend-other@dentsocia.dev", "klinik");
    await verifyOrgKyc(ownerId);
    const jobId = await createJob(ownerToken);

    const forbidden = await request(app).post(`/api/v1/jobs/${jobId}/extend`).set("Authorization", `Bearer ${otherToken}`);
    expect(forbidden.status).toBe(403);

    const beforeExtend = await request(app).get("/api/v1/jobs/mine").set("Authorization", `Bearer ${ownerToken}`);
    const originalExpiresAt = beforeExtend.body.jobs[0].expiresAt;

    const extended = await request(app).post(`/api/v1/jobs/${jobId}/extend`).set("Authorization", `Bearer ${ownerToken}`);
    expect(extended.status).toBe(200);
    expect(new Date(extended.body.expiresAt).getTime()).toBeGreaterThan(new Date(originalExpiresAt).getTime());
  });

  it("rejects extending a closed job", async () => {
    const { accessToken, userId } = await registerAndLogin("lifecycle-extend-closed@dentsocia.dev", "klinik");
    await verifyOrgKyc(userId);
    const jobId = await createJob(accessToken);

    await request(app)
      .patch(`/api/v1/jobs/${jobId}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "closed" });

    const response = await request(app).post(`/api/v1/jobs/${jobId}/extend`).set("Authorization", `Bearer ${accessToken}`);
    expect(response.status).toBe(409);
  });

  it("closes a job with closeReason 'manual' via the status endpoint", async () => {
    const { accessToken, userId } = await registerAndLogin("lifecycle-manual-close@dentsocia.dev", "klinik");
    await verifyOrgKyc(userId);
    const jobId = await createJob(accessToken);

    const response = await request(app)
      .patch(`/api/v1/jobs/${jobId}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "closed" });

    expect(response.status).toBe(200);
    expect(response.body.closeReason).toBe("manual");
  });

  it("rejects marking a job filled with a non-accepted or foreign application", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin(
      "lifecycle-fill-invalid-employer@dentsocia.dev",
      "klinik",
    );
    await verifyOrgKyc(employerId);
    const jobId = await createJob(employerToken);

    const { accessToken: candidateToken } = await registerAndLogin("lifecycle-fill-invalid-candidate@dentsocia.dev");
    const applied = await request(app)
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${candidateToken}`)
      .send({});

    // still "pending", not "accepted"
    const rejectedPending = await request(app)
      .post(`/api/v1/jobs/${jobId}/mark-filled`)
      .set("Authorization", `Bearer ${employerToken}`)
      .send({ applicationId: applied.body.id });
    expect(rejectedPending.status).toBe(400);

    const rejectedMissing = await request(app)
      .post(`/api/v1/jobs/${jobId}/mark-filled`)
      .set("Authorization", `Bearer ${employerToken}`)
      .send({ applicationId: "000000000000000000000000" });
    expect(rejectedMissing.status).toBe(404);
  });

  it("marks a job filled with an accepted application, closes it, and schedules a post-hire verification", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin(
      "lifecycle-fill-employer@dentsocia.dev",
      "klinik",
    );
    await verifyOrgKyc(employerId);
    const jobId = await createJob(employerToken, "Doldurulacak ilan");

    const { accessToken: candidateToken, userId: candidateId } = await registerAndLogin("lifecycle-fill-candidate@dentsocia.dev");
    const applied = await request(app)
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${candidateToken}`)
      .send({});
    await request(app)
      .patch(`/api/v1/applications/${applied.body.id}/status`)
      .set("Authorization", `Bearer ${employerToken}`)
      .send({ status: "accepted" });

    const filled = await request(app)
      .post(`/api/v1/jobs/${jobId}/mark-filled`)
      .set("Authorization", `Bearer ${employerToken}`)
      .send({ applicationId: applied.body.id });

    expect(filled.status).toBe(200);
    expect(filled.body.status).toBe("closed");
    expect(filled.body.closeReason).toBe("filled");
    expect(filled.body.filledApplicationId).toBe(applied.body.id);

    const { PostHireVerificationModel } = await import("./models/PostHireVerification");
    const verification = await PostHireVerificationModel.findOne({ jobId });
    expect(verification).not.toBeNull();
    expect(verification!.candidateId.toString()).toBe(candidateId);
    expect(verification!.status).toBe("pending");
    expect(verification!.dueAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("runJobExpirySweep sends a reminder for jobs expiring soon and auto-closes expired jobs", async () => {
    const { accessToken, userId } = await registerAndLogin("lifecycle-sweep@dentsocia.dev", "klinik");
    await verifyOrgKyc(userId);
    const soonJobId = await createJob(accessToken, "Yakında kapanacak ilan");
    const expiredJobId = await createJob(accessToken, "Süresi geçmiş ilan");

    const { JobModel } = await import("./models/Job");
    await JobModel.findByIdAndUpdate(soonJobId, { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    await JobModel.findByIdAndUpdate(expiredJobId, { expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });

    const beforeCount = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${accessToken}`);

    const { runJobExpirySweep } = await import("./scheduledTasks/jobExpiry.task");
    await runJobExpirySweep();

    const afterCount = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(afterCount.body.count).toBe(beforeCount.body.count + 1);

    const soonJob = await JobModel.findById(soonJobId);
    expect(soonJob!.status).toBe("open");
    expect(soonJob!.expiryReminderSentAt).not.toBeNull();

    const expiredJob = await JobModel.findById(expiredJobId);
    expect(expiredJob!.status).toBe("closed");
    expect(expiredJob!.closeReason).toBe("expired");

    // running again shouldn't double-notify for the same reminder
    await runJobExpirySweep();
    const afterSecondRun = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(afterSecondRun.body.count).toBe(afterCount.body.count);
  });
});

describe("Post-hire verification endpoints (§8.5)", () => {
  it("only surfaces due verifications, lets the candidate answer, and reflects the answer in the employer's org profile", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin(
      "phv-full-employer@dentsocia.dev",
      "klinik",
    );
    await verifyOrgKyc(employerId);
    const jobId = await createJob(employerToken, "Doğrulama akışı ilanı");

    const { accessToken: candidateToken, userId: candidateId } = await registerAndLogin("phv-full-candidate@dentsocia.dev");
    const applied = await request(app)
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${candidateToken}`)
      .send({});
    await request(app)
      .patch(`/api/v1/applications/${applied.body.id}/status`)
      .set("Authorization", `Bearer ${employerToken}`)
      .send({ status: "accepted" });
    await request(app)
      .post(`/api/v1/jobs/${jobId}/mark-filled`)
      .set("Authorization", `Bearer ${employerToken}`)
      .send({ applicationId: applied.body.id });

    // Not due yet — shouldn't show up.
    const tooEarly = await request(app)
      .get("/api/v1/post-hire-verifications/mine")
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(tooEarly.body.verifications).toHaveLength(0);

    // Baseline includes the "application accepted" notification from above — the sweep should add exactly one more.
    const beforeSweep = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${candidateToken}`);

    const { PostHireVerificationModel } = await import("./models/PostHireVerification");
    await PostHireVerificationModel.updateMany(
      { candidateId },
      { dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    );

    const { runPostHireVerificationSweep } = await import("./services/postHireVerification.service");
    await runPostHireVerificationSweep();

    const unreadCount = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(unreadCount.body.count).toBe(beforeSweep.body.count + 1);

    const due = await request(app)
      .get("/api/v1/post-hire-verifications/mine")
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(due.body.verifications).toHaveLength(1);
    const verificationId = due.body.verifications[0].id;

    const wrongCandidate = await request(app)
      .post(`/api/v1/post-hire-verifications/${verificationId}/answer`)
      .set("Authorization", `Bearer ${employerToken}`)
      .send({ answer: true });
    expect(wrongCandidate.status).toBe(404);

    const answered = await request(app)
      .post(`/api/v1/post-hire-verifications/${verificationId}/answer`)
      .set("Authorization", `Bearer ${candidateToken}`)
      .send({ answer: true });
    expect(answered.status).toBe(200);
    expect(answered.body.status).toBe("answered");
    expect(answered.body.answer).toBe(true);

    const secondAnswer = await request(app)
      .post(`/api/v1/post-hire-verifications/${verificationId}/answer`)
      .set("Authorization", `Bearer ${candidateToken}`)
      .send({ answer: false });
    expect(secondAnswer.status).toBe(404);

    const orgProfile = await request(app)
      .get(`/api/v1/orgs/${employerId}`)
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(orgProfile.body.postHireVerificationStats).toEqual({ pendingCount: 0, yesCount: 1, noCount: 0 });
  });
});
