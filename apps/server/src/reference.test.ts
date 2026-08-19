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

describe("Reference endpoints", () => {
  it("rejects requests without an access token", async () => {
    const response = await request(app).get("/api/v1/references/me");
    expect(response.status).toBe(401);
  });

  it("rejects a corporate account requesting a reference about itself", async () => {
    const { accessToken: orgToken } = await registerAndLogin("ref-corp-requester@dentsocia.dev", "klinik");
    const { userId: authorId } = await registerAndLogin("ref-corp-requester-author@dentsocia.dev");

    const response = await request(app)
      .post("/api/v1/references/requests")
      .set("Authorization", `Bearer ${orgToken}`)
      .send({ targetUserId: authorId });

    expect(response.status).toBe(400);
  });

  it("rejects writing a reference about a corporate account", async () => {
    const { accessToken } = await registerAndLogin("ref-corp-write-author@dentsocia.dev");
    const { userId: orgId } = await registerAndLogin("ref-corp-write-target@dentsocia.dev", "klinik");

    const response = await request(app)
      .post("/api/v1/references")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ targetUserId: orgId, body: "Harika bir kurum" });

    expect(response.status).toBe(400);
  });

  it("supports the request → fulfill flow and makes the reference public", async () => {
    const { accessToken: subjectToken, userId: subjectId } = await registerAndLogin("ref-flow-subject@dentsocia.dev");
    const { accessToken: authorToken, userId: authorId } = await registerAndLogin("ref-flow-author@dentsocia.dev");

    const requested = await request(app)
      .post("/api/v1/references/requests")
      .set("Authorization", `Bearer ${subjectToken}`)
      .send({ targetUserId: authorId });
    expect(requested.status).toBe(201);
    expect(requested.body.status).toBe("pending");

    const incoming = await request(app)
      .get("/api/v1/references/requests/incoming")
      .set("Authorization", `Bearer ${authorToken}`);
    expect(incoming.body.references.some((ref: { id: string }) => ref.id === requested.body.id)).toBe(true);

    const fulfilled = await request(app)
      .post(`/api/v1/references/requests/${requested.body.id}/fulfill`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ relationship: "Birlikte çalıştık", body: "Çok yetkin bir meslektaş" });
    expect(fulfilled.status).toBe(200);
    expect(fulfilled.body.status).toBe("written");

    const publicProfile = await request(app)
      .get(`/api/v1/profiles/${subjectId}`)
      .set("Authorization", `Bearer ${authorToken}`);
    expect(publicProfile.status).toBe(200);
    expect(publicProfile.body.references).toHaveLength(1);
    expect(publicProfile.body.references[0].body).toBe("Çok yetkin bir meslektaş");
  });

  it("allows writing a reference directly without a prior request", async () => {
    const { userId: subjectId } = await registerAndLogin("ref-direct-subject@dentsocia.dev");
    const { accessToken: authorToken } = await registerAndLogin("ref-direct-author@dentsocia.dev");

    const response = await request(app)
      .post("/api/v1/references")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ targetUserId: subjectId, body: "Doğrudan yazılmış referans" });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("written");
  });

  it("rejects fulfilling someone else's pending request", async () => {
    const { accessToken: subjectToken } = await registerAndLogin("ref-403-subject@dentsocia.dev");
    const { userId: authorId } = await registerAndLogin("ref-403-author@dentsocia.dev");
    const { accessToken: outsiderToken } = await registerAndLogin("ref-403-outsider@dentsocia.dev");

    const requested = await request(app)
      .post("/api/v1/references/requests")
      .set("Authorization", `Bearer ${subjectToken}`)
      .send({ targetUserId: authorId });

    const response = await request(app)
      .post(`/api/v1/references/requests/${requested.body.id}/fulfill`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ body: "İzinsiz doldurma" });

    expect(response.status).toBe(403);
  });

  it("removes a reference from the public profile once its visibility is hidden", async () => {
    const { accessToken: subjectToken, userId: subjectId } = await registerAndLogin("ref-hide-subject@dentsocia.dev");
    const { accessToken: authorToken } = await registerAndLogin("ref-hide-author@dentsocia.dev");

    const written = await request(app)
      .post("/api/v1/references")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ targetUserId: subjectId, body: "Gizlenecek referans" });

    const hidden = await request(app)
      .patch(`/api/v1/references/${written.body.id}/visibility`)
      .set("Authorization", `Bearer ${subjectToken}`)
      .send({ hidden: true });
    expect(hidden.status).toBe(200);
    expect(hidden.body.status).toBe("hidden");

    const publicProfile = await request(app)
      .get(`/api/v1/profiles/${subjectId}`)
      .set("Authorization", `Bearer ${authorToken}`);
    expect(publicProfile.body.references).toHaveLength(0);
  });
});
