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
    .send({ title });
  return response.body.id as string;
}

describe("Application endpoints", () => {
  it("rejects applying to a closed job", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin(
      "app-closed-employer@dentsocia.dev",
      "klinik",
    );
    const { accessToken: applicantToken } = await registerAndLogin("app-closed-applicant@dentsocia.dev", "hekim");
    const jobId = await createJob(employerToken, employerId);

    await request(app)
      .patch(`/api/v1/jobs/${jobId}/status`)
      .set("Authorization", `Bearer ${employerToken}`)
      .send({ status: "closed" });

    const response = await request(app)
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({});

    expect(response.status).toBe(409);
  });

  it("rejects applying to your own job", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin(
      "app-self-employer@dentsocia.dev",
      "firma",
    );
    const jobId = await createJob(employerToken, employerId);

    const response = await request(app)
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${employerToken}`)
      .send({});

    expect(response.status).toBe(400);
  });

  it("creates an application and rejects a duplicate application", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin(
      "app-dup-employer@dentsocia.dev",
      "dernek",
    );
    const { accessToken: applicantToken } = await registerAndLogin("app-dup-applicant@dentsocia.dev", "teknisyen");
    const jobId = await createJob(employerToken, employerId);

    const first = await request(app)
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ message: "İlginizi çekmek isterim" });

    expect(first.status).toBe(201);
    expect(first.body.status).toBe("pending");
    expect(first.body.job.id).toBe(jobId);

    const second = await request(app)
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({});

    expect(second.status).toBe(409);
  });

  it("returns the applicant's own applications with job info", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin(
      "app-mine-employer@dentsocia.dev",
      "klinik",
    );
    const { accessToken: applicantToken } = await registerAndLogin("app-mine-applicant@dentsocia.dev", "asistan");
    const jobId = await createJob(employerToken, employerId, "Klinik Asistanı aranıyor");

    await request(app)
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({});

    const response = await request(app)
      .get("/api/v1/applications/mine")
      .set("Authorization", `Bearer ${applicantToken}`);

    expect(response.status).toBe(200);
    expect(response.body.applications).toHaveLength(1);
    expect(response.body.applications[0].job.title).toBe("Klinik Asistanı aranıyor");
  });

  it("only lets the job owner view and manage applications", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin(
      "app-manage-employer@dentsocia.dev",
      "firma",
    );
    const { accessToken: otherToken } = await registerAndLogin("app-manage-other@dentsocia.dev", "klinik");
    const { accessToken: applicantToken } = await registerAndLogin("app-manage-applicant@dentsocia.dev", "hekim");
    const jobId = await createJob(employerToken, employerId);

    const applied = await request(app)
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({});

    const forbidden = await request(app)
      .get(`/api/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(forbidden.status).toBe(403);

    const list = await request(app)
      .get(`/api/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${employerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.applications).toHaveLength(1);
    expect(list.body.applications[0].applicant).toBeTruthy();

    const accept = await request(app)
      .patch(`/api/v1/applications/${applied.body.id}/status`)
      .set("Authorization", `Bearer ${employerToken}`)
      .send({ status: "accepted" });
    expect(accept.status).toBe(200);
    expect(accept.body.status).toBe("accepted");

    const deniedUpdate = await request(app)
      .patch(`/api/v1/applications/${applied.body.id}/status`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ status: "rejected" });
    expect(deniedUpdate.status).toBe(403);
  });
});
