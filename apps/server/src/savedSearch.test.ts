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

const jobDefaults = {
  description: "Yarı zamanlı çalışacak diş hekimi arıyoruz.",
  position: "Diş hekimi",
  paymentModel: "Sabit maaş",
  workDays: ["Pazartesi", "Salı"],
  workHoursStart: "09:00",
  workHoursEnd: "18:00",
  hasSgk: true,
};

describe("Saved search endpoints", () => {
  it("rejects requests without an access token", async () => {
    const response = await request(app).get("/api/v1/saved-searches/mine");
    expect(response.status).toBe(401);
  });

  it("rejects saved-search creation for a non-candidate role", async () => {
    const { accessToken } = await registerAndLogin("saved-search-org@dentsocia.dev", "klinik");

    const response = await request(app)
      .post("/api/v1/saved-searches")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ label: "İzmir yarı zamanlı", criteria: { location: "İzmir" } });

    expect(response.status).toBe(403);
  });

  it("creates, lists and deletes a saved search", async () => {
    const { accessToken } = await registerAndLogin("saved-search-crud@dentsocia.dev");

    const created = await request(app)
      .post("/api/v1/saved-searches")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ label: "İzmir yarı zamanlı", criteria: { location: "İzmir", workType: "Yarı zamanlı" } });
    expect(created.status).toBe(201);
    expect(created.body.label).toBe("İzmir yarı zamanlı");
    expect(created.body.criteria.location).toBe("izmir");

    const list = await request(app)
      .get("/api/v1/saved-searches/mine")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.savedSearches).toHaveLength(1);

    const deleted = await request(app)
      .delete(`/api/v1/saved-searches/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleted.status).toBe(204);

    const secondDelete = await request(app)
      .delete(`/api/v1/saved-searches/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(secondDelete.status).toBe(404);

    const listAfter = await request(app)
      .get("/api/v1/saved-searches/mine")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(listAfter.body.savedSearches).toHaveLength(0);
  });

  it("caps the number of saved searches per user", async () => {
    const { accessToken } = await registerAndLogin("saved-search-cap@dentsocia.dev");

    for (let i = 0; i < 10; i += 1) {
      const response = await request(app)
        .post("/api/v1/saved-searches")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ criteria: { location: `Şehir ${i}` } });
      expect(response.status).toBe(201);
    }

    const eleventh = await request(app)
      .post("/api/v1/saved-searches")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ criteria: { location: "Şehir 11" } });
    expect(eleventh.status).toBe(400);
  });

  it("notifies the owner of a matching saved search when a new job is posted, but not a non-matching one", async () => {
    const { accessToken: candidateToken } = await registerAndLogin("saved-search-match-candidate@dentsocia.dev");
    await request(app)
      .post("/api/v1/saved-searches")
      .set("Authorization", `Bearer ${candidateToken}`)
      .send({ criteria: { location: "İzmir", workType: "Yarı zamanlı", branch: "Endodonti" } });

    const { accessToken: employerToken, userId: employerId } = await registerAndLogin(
      "saved-search-match-employer@dentsocia.dev",
      "klinik",
    );
    await verifyOrgKyc(employerId);

    const beforeCount = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(beforeCount.body.count).toBe(0);

    // Non-matching job (different branch) — should not trigger a notification.
    await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${employerToken}`)
      .send({
        title: "İzmir'de yarı zamanlı ortodontist aranıyor",
        location: "İzmir",
        workType: "Yarı zamanlı",
        branch: "Ortodonti",
        experienceLevel: "1-3 yıl",
        ...jobDefaults,
      });

    const afterNonMatch = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(afterNonMatch.body.count).toBe(0);

    // Matching job (location + workType + branch all match, experienceLevel unset in the saved search).
    await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${employerToken}`)
      .send({
        title: "İzmir'de yarı zamanlı endodontist aranıyor",
        location: "İzmir",
        workType: "Yarı zamanlı",
        branch: "Endodonti",
        experienceLevel: "5+ yıl",
        ...jobDefaults,
      });

    const afterMatch = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(afterMatch.body.count).toBe(1);
  });
});
