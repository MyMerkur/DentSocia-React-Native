import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";

let mongoServer: MongoMemoryServer;
let app: Express;

const ADMIN_EMAIL = "report-admin@dentsocia.dev";

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.ATLAS_URI_DEV = mongoServer.getUri();
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  process.env.FIELD_ENCRYPTION_KEY = "test-field-encryption-key-32-bytes!!";
  process.env.AUTH_RATE_LIMIT_MAX = "1000";
  process.env.ADMIN_EMAILS = ADMIN_EMAIL;

  const { connectDB } = await import("./config/db");
  await connectDB();
  app = (await import("./app")).default;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

async function registerAndLogin(email: string) {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "Supersecret123", role: "hekim" });
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

describe("Report endpoints", () => {
  it("rejects requests without an access token", async () => {
    const response = await request(app).post("/api/v1/reports").send({});
    expect(response.status).toBe(401);
  });

  it("rejects a non-admin listing or resolving reports", async () => {
    const { accessToken } = await registerAndLogin("report-not-admin@dentsocia.dev");

    const listResponse = await request(app).get("/api/v1/reports").set("Authorization", `Bearer ${accessToken}`);
    expect(listResponse.status).toBe(403);

    const resolveResponse = await request(app)
      .post("/api/v1/reports/000000000000000000000000/resolve")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "resolved" });
    expect(resolveResponse.status).toBe(403);
  });

  it("creates a report, lists it in the open admin queue, and resolves it", async () => {
    const { accessToken, userId: reporterId } = await registerAndLogin("report-creator@dentsocia.dev");
    const { userId: targetUserId } = await registerAndLogin("report-target@dentsocia.dev");

    const created = await request(app)
      .post("/api/v1/reports")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ targetType: "user", targetId: targetUserId, reason: "harassment", details: "Uygunsuz mesajlar gönderiyor" });

    expect(created.status).toBe(201);
    expect(created.body.status).toBe("open");
    expect(created.body.targetId).toBe(targetUserId);

    const adminToken = await getAdminToken();
    const openList = await request(app).get("/api/v1/reports").set("Authorization", `Bearer ${adminToken}`);
    expect(openList.status).toBe(200);
    const found = openList.body.reports.find((report: { id: string }) => report.id === created.body.id);
    expect(found).toBeTruthy();
    expect(found.reporter.id).toBe(reporterId);

    const resolved = await request(app)
      .post(`/api/v1/reports/${created.body.id}/resolve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "resolved", resolutionNote: "Kullanıcı uyarıldı" });
    expect(resolved.status).toBe(200);
    expect(resolved.body.status).toBe("resolved");

    const openAfter = await request(app).get("/api/v1/reports").set("Authorization", `Bearer ${adminToken}`);
    expect(openAfter.body.reports.some((report: { id: string }) => report.id === created.body.id)).toBe(false);

    const resolvedList = await request(app)
      .get("/api/v1/reports?status=resolved")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(resolvedList.body.reports.some((report: { id: string }) => report.id === created.body.id)).toBe(true);
  });

  it("rejects resolving an already-resolved report a second time", async () => {
    const { accessToken, userId: targetUserId } = await registerAndLogin("report-double-resolve@dentsocia.dev");
    const created = await request(app)
      .post("/api/v1/reports")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ targetType: "job", targetId: targetUserId, reason: "spam" });

    const adminToken = await getAdminToken();
    await request(app)
      .post(`/api/v1/reports/${created.body.id}/resolve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "dismissed" });

    const secondResolve = await request(app)
      .post(`/api/v1/reports/${created.body.id}/resolve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "resolved" });
    expect(secondResolve.status).toBe(404);
  });
});
