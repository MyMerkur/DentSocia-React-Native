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

// FEATURE_FLAGS.orgReviews=false — PRD v3 explicitly says this is not planned, gates the write/list tests below
describe("Clinic review endpoints", () => {
  it("rejects requests without an access token", async () => {
    const response = await request(app).get("/api/v1/orgs/000000000000000000000000/reviews");
    expect(response.status).toBe(401);
  });

  it("rejects rating a non-corporate account", async () => {
    const { accessToken: raterToken } = await registerAndLogin("review-non-corp-rater@dentsocia.dev");
    const { userId: targetId } = await registerAndLogin("review-non-corp-target@dentsocia.dev");

    const response = await request(app)
      .post(`/api/v1/orgs/${targetId}/reviews`)
      .set("Authorization", `Bearer ${raterToken}`)
      .send({ rating: 5 });

    expect(response.status).toBe(404);
  });

  it.skip("treats a second rating from the same user as an update, not a duplicate", async () => {
    const { accessToken: raterToken } = await registerAndLogin("review-upsert-rater@dentsocia.dev");
    const { userId: orgId } = await registerAndLogin("review-upsert-org@dentsocia.dev", "klinik");

    await request(app)
      .post(`/api/v1/orgs/${orgId}/reviews`)
      .set("Authorization", `Bearer ${raterToken}`)
      .send({ rating: 3, comment: "İlk izlenim" });

    await request(app)
      .post(`/api/v1/orgs/${orgId}/reviews`)
      .set("Authorization", `Bearer ${raterToken}`)
      .send({ rating: 5, comment: "Güncellenmiş yorum" });

    const reviews = await request(app)
      .get(`/api/v1/orgs/${orgId}/reviews`)
      .set("Authorization", `Bearer ${raterToken}`);

    expect(reviews.body.reviews).toHaveLength(1);
    expect(reviews.body.reviews[0].rating).toBe(5);
    expect(reviews.body.reviews[0].comment).toBe("Güncellenmiş yorum");
  });

  it.skip("computes the average rating correctly on the org profile", async () => {
    const { accessToken: raterOneToken } = await registerAndLogin("review-avg-rater-one@dentsocia.dev");
    const { accessToken: raterTwoToken } = await registerAndLogin("review-avg-rater-two@dentsocia.dev");
    const { userId: orgId } = await registerAndLogin("review-avg-org@dentsocia.dev", "firma");

    await request(app)
      .post(`/api/v1/orgs/${orgId}/reviews`)
      .set("Authorization", `Bearer ${raterOneToken}`)
      .send({ rating: 4 });
    await request(app)
      .post(`/api/v1/orgs/${orgId}/reviews`)
      .set("Authorization", `Bearer ${raterTwoToken}`)
      .send({ rating: 2 });

    const profile = await request(app)
      .get(`/api/v1/orgs/${orgId}`)
      .set("Authorization", `Bearer ${raterOneToken}`);

    expect(profile.body.rating.average).toBe(3);
    expect(profile.body.rating.count).toBe(2);
  });
});
