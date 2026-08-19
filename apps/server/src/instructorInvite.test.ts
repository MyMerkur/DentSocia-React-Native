import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";

let mongoServer: MongoMemoryServer;
let app: Express;

const ADMIN_EMAIL = "admin@dentsocia.dev";

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.ATLAS_URI_DEV = mongoServer.getUri();
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  process.env.AUTH_RATE_LIMIT_MAX = "1000";
  process.env.FIELD_ENCRYPTION_KEY = "test-field-encryption-key-32-bytes!!";
  process.env.ADMIN_EMAILS = ADMIN_EMAIL;

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

async function getKycLevel(accessToken: string) {
  const response = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);
  return response.body.kycLevel as number;
}

// FEATURE_FLAGS.instructorEconomy=false gates this whole router — see packages/shared-constants/src/featureFlags.ts
describe("Instructor invite endpoints", () => {
  let adminToken: string;

  beforeAll(async () => {
    ({ accessToken: adminToken } = await registerAndLogin(ADMIN_EMAIL));
  });

  it("rejects requests without an access token", async () => {
    const createRes = await request(app).post("/api/v1/admin/instructor-invites").send({ email: "x@dentsocia.dev" });
    expect(createRes.status).toBe(401);

    const acceptRes = await request(app).post("/api/v1/instructor-invites/some-token/accept");
    expect(acceptRes.status).toBe(401);
  });

  it.skip("rejects a non-admin user creating an invite", async () => {
    const { accessToken } = await registerAndLogin("not-admin@dentsocia.dev");
    const response = await request(app)
      .post("/api/v1/admin/instructor-invites")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ email: "target@dentsocia.dev" });
    expect(response.status).toBe(403);
  });

  it.skip("supports the full invite → accept flow and bumps kycLevel to 4", async () => {
    const { accessToken: targetToken } = await registerAndLogin("invite-target@dentsocia.dev");

    const before = await getKycLevel(targetToken);
    expect(before).toBe(0);

    const created = await request(app)
      .post("/api/v1/admin/instructor-invites")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "invite-target@dentsocia.dev" });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("pending");

    const listRes = await request(app)
      .get("/api/v1/admin/instructor-invites")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.invites.some((invite: { id: string }) => invite.id === created.body.id)).toBe(true);

    // token isn't returned in the API response (only sent via email) — read it directly from the DB for the test
    const { InstructorInviteModel } = await import("./models/InstructorInvite");
    const inviteDoc = await InstructorInviteModel.findById(created.body.id);
    const token = inviteDoc!.token;

    const accepted = await request(app)
      .post(`/api/v1/instructor-invites/${token}/accept`)
      .set("Authorization", `Bearer ${targetToken}`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe("accepted");

    const after = await getKycLevel(targetToken);
    expect(after).toBe(4);
  });

  it.skip("rejects accepting an invite meant for a different email", async () => {
    const created = await request(app)
      .post("/api/v1/admin/instructor-invites")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "correct-recipient@dentsocia.dev" });

    const { InstructorInviteModel } = await import("./models/InstructorInvite");
    const inviteDoc = await InstructorInviteModel.findById(created.body.id);
    const token = inviteDoc!.token;

    const { accessToken: outsiderToken } = await registerAndLogin("wrong-recipient@dentsocia.dev");
    const response = await request(app)
      .post(`/api/v1/instructor-invites/${token}/accept`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(response.status).toBe(403);
  });

  it.skip("rejects accepting an already-accepted invite", async () => {
    const created = await request(app)
      .post("/api/v1/admin/instructor-invites")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "double-accept@dentsocia.dev" });

    const { InstructorInviteModel } = await import("./models/InstructorInvite");
    const inviteDoc = await InstructorInviteModel.findById(created.body.id);
    const token = inviteDoc!.token;

    const { accessToken: targetToken } = await registerAndLogin("double-accept@dentsocia.dev");
    const first = await request(app)
      .post(`/api/v1/instructor-invites/${token}/accept`)
      .set("Authorization", `Bearer ${targetToken}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/v1/instructor-invites/${token}/accept`)
      .set("Authorization", `Bearer ${targetToken}`);
    expect(second.status).toBe(400);
  });
});
