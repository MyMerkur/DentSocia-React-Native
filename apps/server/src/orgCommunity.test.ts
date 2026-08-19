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
  process.env.AUTH_RATE_LIMIT_MAX = "1000";
  process.env.FIELD_ENCRYPTION_KEY = "test-field-encryption-key-32-bytes!!";

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

// Affiliation now requires the org's approval (see user.test.ts for that flow itself) — these
// tests are about announcements/votes/etc., so membership is set up directly for brevity.
async function affiliate(accessToken: string, orgUserId: string) {
  const meRes = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);
  const { UserModel } = await import("./models/User");
  await UserModel.findByIdAndUpdate(meRes.body.id, { affiliatedOrgId: orgUserId });
}

async function verifyOrgKyc(userId: string) {
  const { UserModel } = await import("./models/User");
  await UserModel.findByIdAndUpdate(userId, { kycLevel: 3 });
}

// FEATURE_FLAGS.associationTools=false gates the announcement/vote tests below (device token test is unaffected)
describe("Org community: announcements, votes, device tokens", () => {
  it.skip("rejects announcement/vote creation for non-dernek accounts", async () => {
    const { accessToken, userId } = await registerAndLogin("org-notdernek@dentsocia.dev", "klinik");

    const announcementRes = await request(app)
      .post(`/api/v1/orgs/${userId}/announcements`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Başlık", body: "İçerik" });
    expect(announcementRes.status).toBe(403);

    const voteRes = await request(app)
      .post(`/api/v1/orgs/${userId}/votes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ question: "Soru?", options: ["A", "B"] });
    expect(voteRes.status).toBe(403);
  });

  it.skip("rejects announcement/vote creation for an unverified dernek account", async () => {
    const { accessToken, userId } = await registerAndLogin("org-unverified-dernek@dentsocia.dev", "dernek");

    const announcementRes = await request(app)
      .post(`/api/v1/orgs/${userId}/announcements`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Başlık", body: "İçerik" });
    expect(announcementRes.status).toBe(403);

    const voteRes = await request(app)
      .post(`/api/v1/orgs/${userId}/votes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ question: "Soru?", options: ["A", "B"] });
    expect(voteRes.status).toBe(403);
  });

  it.skip("rejects listing announcements for non-members", async () => {
    const { userId: orgId } = await registerAndLogin("org-owner-1@dentsocia.dev", "dernek");
    const { accessToken: outsiderToken } = await registerAndLogin("org-outsider-1@dentsocia.dev");

    const listRes = await request(app)
      .get(`/api/v1/orgs/${orgId}/announcements`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(listRes.status).toBe(403);
  });

  it.skip("creates an announcement and notifies affiliated members", async () => {
    const { accessToken: ownerToken, userId: orgId } = await registerAndLogin("org-owner-2@dentsocia.dev", "dernek");
    await verifyOrgKyc(orgId);
    const { accessToken: memberToken } = await registerAndLogin("org-member-2@dentsocia.dev");
    await affiliate(memberToken, orgId);

    const createRes = await request(app)
      .post(`/api/v1/orgs/${orgId}/announcements`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Genel Kurul", body: "Genel kurul 3 hafta sonra yapılacak" });
    expect(createRes.status).toBe(201);
    expect(createRes.body.title).toBe("Genel Kurul");

    const notifRes = await request(app).get("/api/v1/notifications").set("Authorization", `Bearer ${memberToken}`);
    expect(
      (notifRes.body.notifications as { type: string }[]).some((n) => n.type === "org_announcement"),
    ).toBe(true);

    const listRes = await request(app)
      .get(`/api/v1/orgs/${orgId}/announcements`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.announcements).toHaveLength(1);
  });

  it.skip("runs the full vote lifecycle: open -> cast -> duplicate 409 -> results -> close -> cast-on-closed 400", async () => {
    const { accessToken: ownerToken, userId: orgId } = await registerAndLogin("org-owner-3@dentsocia.dev", "dernek");
    await verifyOrgKyc(orgId);
    const { accessToken: memberToken } = await registerAndLogin("org-member-3@dentsocia.dev");
    await affiliate(memberToken, orgId);

    const createRes = await request(app)
      .post(`/api/v1/orgs/${orgId}/votes`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ question: "Yeni yönetim kurulu?", options: ["Evet", "Hayır"] });
    expect(createRes.status).toBe(201);
    const voteId = createRes.body.id as string;

    const castRes = await request(app)
      .post(`/api/v1/orgs/votes/${voteId}/ballot`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ optionIndex: 0 });
    expect(castRes.status).toBe(201);

    const duplicateRes = await request(app)
      .post(`/api/v1/orgs/votes/${voteId}/ballot`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ optionIndex: 1 });
    expect(duplicateRes.status).toBe(409);

    const listRes = await request(app)
      .get(`/api/v1/orgs/${orgId}/votes`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(listRes.status).toBe(200);
    const vote = listRes.body.votes[0];
    expect(vote.results).toEqual([
      { option: "Evet", count: 1 },
      { option: "Hayır", count: 0 },
    ]);
    expect(vote.myOptionIndex).toBe(0);

    const closeRes = await request(app)
      .post(`/api/v1/orgs/votes/${voteId}/close`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.status).toBe("closed");

    const { accessToken: secondMemberToken } = await registerAndLogin("org-member-3b@dentsocia.dev");
    await affiliate(secondMemberToken, orgId);
    const castOnClosedRes = await request(app)
      .post(`/api/v1/orgs/votes/${voteId}/ballot`)
      .set("Authorization", `Bearer ${secondMemberToken}`)
      .send({ optionIndex: 0 });
    expect(castOnClosedRes.status).toBe(400);
  });

  it("registers a device token and moves it to a new user on re-registration", async () => {
    const { accessToken: firstToken } = await registerAndLogin("device-first@dentsocia.dev");
    const { accessToken: secondToken, userId: secondUserId } = await registerAndLogin("device-second@dentsocia.dev");

    const registerRes = await request(app)
      .post("/api/v1/notifications/device-token")
      .set("Authorization", `Bearer ${firstToken}`)
      .send({ token: "shared-device-token-1", platform: "ios" });
    expect(registerRes.status).toBe(200);

    const reRegisterRes = await request(app)
      .post("/api/v1/notifications/device-token")
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ token: "shared-device-token-1", platform: "android" });
    expect(reRegisterRes.status).toBe(200);

    const { DeviceTokenModel } = await import("./models/DeviceToken");
    const stored = await DeviceTokenModel.findOne({ token: "shared-device-token-1" });
    expect(stored?.userId.toString()).toBe(secondUserId);
    expect(stored?.platform).toBe("android");
  });
});
