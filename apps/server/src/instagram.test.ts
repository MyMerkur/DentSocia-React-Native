import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";

const mockExchangeCodeForToken = jest.fn();
const mockExchangeForLongLivedToken = jest.fn();
const mockRefreshLongLivedToken = jest.fn();
const mockFetchProfile = jest.fn();
const mockFetchMedia = jest.fn();

jest.mock("./services/instagramGraph.service", () => ({
  exchangeCodeForToken: (...args: unknown[]) => mockExchangeCodeForToken(...args),
  exchangeForLongLivedToken: (...args: unknown[]) => mockExchangeForLongLivedToken(...args),
  refreshLongLivedToken: (...args: unknown[]) => mockRefreshLongLivedToken(...args),
  fetchProfile: (...args: unknown[]) => mockFetchProfile(...args),
  fetchMedia: (...args: unknown[]) => mockFetchMedia(...args),
}));

let mongoServer: MongoMemoryServer;
let app: Express;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.ATLAS_URI_DEV = mongoServer.getUri();
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  process.env.FIELD_ENCRYPTION_KEY = "test-field-encryption-key-32-bytes!!";
  process.env.AUTH_RATE_LIMIT_MAX = "1000";
  process.env.INSTAGRAM_APP_ID = "test-app-id";
  process.env.INSTAGRAM_APP_SECRET = "test-app-secret";
  process.env.INSTAGRAM_REDIRECT_URI = "https://api.dentsocia.dev/api/v1/instagram/oauth/callback";
  process.env.INSTAGRAM_RATE_LIMIT_MAX = "1000";

  const { connectDB } = await import("./config/db");
  await connectDB();
  app = (await import("./app")).default;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(() => {
  mockExchangeCodeForToken.mockReset();
  mockExchangeForLongLivedToken.mockReset();
  mockRefreshLongLivedToken.mockReset();
  mockFetchProfile.mockReset();
  mockFetchMedia.mockReset();
});

async function registerAndLogin(email: string) {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "Supersecret123", role: "hekim" });
  return { accessToken: response.body.accessToken as string, userId: response.body.user.id as string };
}

async function makeInstructor(userId: string) {
  const { UserModel } = await import("./models/User");
  await UserModel.findByIdAndUpdate(userId, { kycLevel: 4 });
}

async function connectInstagram(accessToken: string) {
  const connectRes = await request(app).get("/api/v1/instagram/connect").set("Authorization", `Bearer ${accessToken}`);
  const url = new URL(connectRes.body.authorizeUrl);
  const state = url.searchParams.get("state")!;

  mockExchangeCodeForToken.mockResolvedValueOnce({ accessToken: "short-lived-token", instagramUserId: "ig-123" });
  mockExchangeForLongLivedToken.mockResolvedValueOnce({ accessToken: "long-lived-token", expiresInSeconds: 5184000 });
  mockFetchProfile.mockResolvedValueOnce({ id: "ig-123", username: "dr.instructor" });

  return request(app).get("/api/v1/instagram/oauth/callback").query({ code: "auth-code", state });
}

describe("Instagram OAuth endpoints", () => {
  it("rejects requests without an access token", async () => {
    expect((await request(app).get("/api/v1/instagram/connect")).status).toBe(401);
    expect((await request(app).get("/api/v1/instagram/status")).status).toBe(401);
    expect((await request(app).get("/api/v1/instagram/media")).status).toBe(401);
    expect((await request(app).delete("/api/v1/instagram/connection")).status).toBe(401);
  });

  it("rejects non-instructors from connecting", async () => {
    const { accessToken } = await registerAndLogin("ig-non-instructor@dentsocia.dev");
    const response = await request(app).get("/api/v1/instagram/connect").set("Authorization", `Bearer ${accessToken}`);
    expect(response.status).toBe(403);
  });

  it("completes the full connect -> callback -> status flow for an instructor", async () => {
    const { accessToken, userId } = await registerAndLogin("ig-connect@dentsocia.dev");
    await makeInstructor(userId);

    const callbackRes = await connectInstagram(accessToken);
    expect(callbackRes.status).toBe(200);
    expect(callbackRes.text).toContain("başarılı");

    const statusRes = await request(app).get("/api/v1/instagram/status").set("Authorization", `Bearer ${accessToken}`);
    expect(statusRes.body).toEqual({ connected: true, username: "dr.instructor" });
  });

  it("rejects a callback with an unknown or expired state", async () => {
    const response = await request(app)
      .get("/api/v1/instagram/oauth/callback")
      .query({ code: "auth-code", state: "unknown-state" });
    expect(response.status).toBe(400);
  });

  it("returns a cancellation page when the user denies authorization", async () => {
    const response = await request(app)
      .get("/api/v1/instagram/oauth/callback")
      .query({ error: "access_denied", state: "whatever" });
    expect(response.status).toBe(200);
    expect(response.text).toContain("iptal");
  });

  it("returns only IMAGE media and disconnect clears the connection", async () => {
    const { accessToken, userId } = await registerAndLogin("ig-media@dentsocia.dev");
    await makeInstructor(userId);
    await connectInstagram(accessToken);

    mockFetchMedia.mockResolvedValueOnce([
      { id: "1", caption: "Vaka öncesi/sonrası", media_type: "IMAGE", media_url: "https://cdn/1.jpg", permalink: "https://instagram.com/p/1", timestamp: "2026-07-01T00:00:00Z" },
      { id: "2", caption: "Reels", media_type: "VIDEO", media_url: "https://cdn/2.mp4", permalink: "https://instagram.com/p/2", timestamp: "2026-07-02T00:00:00Z" },
    ]);

    const mediaRes = await request(app).get("/api/v1/instagram/media").set("Authorization", `Bearer ${accessToken}`);
    expect(mediaRes.status).toBe(200);
    expect(mediaRes.body.items).toHaveLength(1);
    expect(mediaRes.body.items[0].id).toBe("1");

    const disconnectRes = await request(app)
      .delete("/api/v1/instagram/connection")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(disconnectRes.status).toBe(204);

    const statusRes = await request(app).get("/api/v1/instagram/status").set("Authorization", `Bearer ${accessToken}`);
    expect(statusRes.body.connected).toBe(false);
  });
});
