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

describe("Inbox endpoints", () => {
  it("rejects requests without an access token", async () => {
    const response = await request(app).get("/api/v1/inbox/threads");
    expect(response.status).toBe(401);
  });

  it("starts a thread and assigns the category from the context type", async () => {
    const { accessToken } = await registerAndLogin("inbox-starter@dentsocia.dev");
    const { userId: targetId } = await registerAndLogin("inbox-target@dentsocia.dev");

    const response = await request(app)
      .post("/api/v1/inbox/threads")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ targetUserId: targetId, contextType: "job", contextId: targetId });

    expect(response.status).toBe(200);
    expect(response.body.category).toBe("job");
    expect(response.body.participant.id).toBe(targetId);
  });

  it("defaults to the general category when no context is given", async () => {
    const { accessToken } = await registerAndLogin("inbox-general-a@dentsocia.dev");
    const { userId: targetId } = await registerAndLogin("inbox-general-b@dentsocia.dev");

    const response = await request(app)
      .post("/api/v1/inbox/threads")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ targetUserId: targetId });

    expect(response.status).toBe(200);
    expect(response.body.category).toBe("general");
  });

  it("returns the same thread on a second start between the same two users", async () => {
    const { accessToken } = await registerAndLogin("inbox-dedupe-a@dentsocia.dev");
    const { userId: targetId } = await registerAndLogin("inbox-dedupe-b@dentsocia.dev");

    const first = await request(app)
      .post("/api/v1/inbox/threads")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ targetUserId: targetId, contextType: "case" });
    const second = await request(app)
      .post("/api/v1/inbox/threads")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ targetUserId: targetId });

    expect(first.body.id).toBe(second.body.id);
    expect(second.body.category).toBe("case");
  });

  it("rejects starting a thread with yourself", async () => {
    const { accessToken, userId } = await registerAndLogin("inbox-self@dentsocia.dev");

    const response = await request(app)
      .post("/api/v1/inbox/threads")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ targetUserId: userId });

    expect(response.status).toBe(400);
  });

  it("sends and lists messages within a thread", async () => {
    const { accessToken: senderToken } = await registerAndLogin("inbox-msg-sender@dentsocia.dev");
    const { accessToken: recipientToken, userId: recipientId } = await registerAndLogin("inbox-msg-recipient@dentsocia.dev");

    const thread = await request(app)
      .post("/api/v1/inbox/threads")
      .set("Authorization", `Bearer ${senderToken}`)
      .send({ targetUserId: recipientId });

    const sendResponse = await request(app)
      .post(`/api/v1/inbox/threads/${thread.body.id}/messages`)
      .set("Authorization", `Bearer ${senderToken}`)
      .send({ body: "Merhaba!" });

    expect(sendResponse.status).toBe(201);
    expect(sendResponse.body.body).toBe("Merhaba!");

    const listResponse = await request(app)
      .get(`/api/v1/inbox/threads/${thread.body.id}/messages`)
      .set("Authorization", `Bearer ${recipientToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.messages).toHaveLength(1);
    expect(listResponse.body.messages[0].body).toBe("Merhaba!");
  });

  it("rejects sending a message from a non-participant", async () => {
    const { accessToken: senderToken } = await registerAndLogin("inbox-nonpart-sender@dentsocia.dev");
    const { userId: recipientId } = await registerAndLogin("inbox-nonpart-recipient@dentsocia.dev");
    const { accessToken: outsiderToken } = await registerAndLogin("inbox-nonpart-outsider@dentsocia.dev");

    const thread = await request(app)
      .post("/api/v1/inbox/threads")
      .set("Authorization", `Bearer ${senderToken}`)
      .send({ targetUserId: recipientId });

    const response = await request(app)
      .post(`/api/v1/inbox/threads/${thread.body.id}/messages`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ body: "İzinsiz mesaj" });

    expect(response.status).toBe(403);
  });

  it("marks messages as read when the recipient lists them, and reflects it in unread counts", async () => {
    const { accessToken: senderToken } = await registerAndLogin("inbox-read-sender@dentsocia.dev");
    const { accessToken: recipientToken, userId: recipientId } = await registerAndLogin("inbox-read-recipient@dentsocia.dev");

    const thread = await request(app)
      .post("/api/v1/inbox/threads")
      .set("Authorization", `Bearer ${senderToken}`)
      .send({ targetUserId: recipientId });

    await request(app)
      .post(`/api/v1/inbox/threads/${thread.body.id}/messages`)
      .set("Authorization", `Bearer ${senderToken}`)
      .send({ body: "Okunmamış mesaj" });

    const beforeRead = await request(app)
      .get("/api/v1/inbox/unread-count")
      .set("Authorization", `Bearer ${recipientToken}`);
    expect(beforeRead.body.count).toBe(1);

    await request(app)
      .get(`/api/v1/inbox/threads/${thread.body.id}/messages`)
      .set("Authorization", `Bearer ${recipientToken}`);

    const afterRead = await request(app)
      .get("/api/v1/inbox/unread-count")
      .set("Authorization", `Bearer ${recipientToken}`);
    expect(afterRead.body.count).toBe(0);
  });

  it("lists threads for a user with unread counts", async () => {
    const { accessToken: senderToken } = await registerAndLogin("inbox-list-sender@dentsocia.dev");
    const { accessToken: recipientToken, userId: recipientId } = await registerAndLogin("inbox-list-recipient@dentsocia.dev");

    const thread = await request(app)
      .post("/api/v1/inbox/threads")
      .set("Authorization", `Bearer ${senderToken}`)
      .send({ targetUserId: recipientId });

    await request(app)
      .post(`/api/v1/inbox/threads/${thread.body.id}/messages`)
      .set("Authorization", `Bearer ${senderToken}`)
      .send({ body: "Selam" });

    const response = await request(app)
      .get("/api/v1/inbox/threads")
      .set("Authorization", `Bearer ${recipientToken}`);

    expect(response.status).toBe(200);
    const listed = response.body.threads.find((item: { id: string }) => item.id === thread.body.id);
    expect(listed).toBeDefined();
    expect(listed.unreadCount).toBe(1);
    expect(listed.lastMessagePreview).toBe("Selam");
  });
});
