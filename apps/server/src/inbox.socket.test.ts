import { createServer, type Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";

let mongoServer: MongoMemoryServer;
let app: Express;
let httpServer: HttpServer;
let baseUrl: string;

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
  const { initSockets } = await import("./sockets");

  httpServer = createServer(app);
  initSockets(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address() as AddressInfo;
  baseUrl = `http://localhost:${address.port}`;
}, 60000);

afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await mongoose.disconnect();
  await mongoServer.stop();
});

async function registerAndLogin(email: string) {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "Supersecret123", role: "hekim" });
  return { accessToken: response.body.accessToken as string, userId: response.body.user.id as string };
}

function connect(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, { auth: { token }, transports: ["websocket"] });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", reject);
  });
}

describe("Inbox real-time layer", () => {
  it("delivers a message:new event to the recipient's socket room", async () => {
    const sender = await registerAndLogin("socket-sender@dentsocia.dev");
    const recipient = await registerAndLogin("socket-recipient@dentsocia.dev");

    const recipientSocket = await connect(recipient.accessToken);

    const thread = await request(app)
      .post("/api/v1/inbox/threads")
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .send({ targetUserId: recipient.userId });

    const receivedEvent = new Promise<{ threadId: string; message: { body: string } }>((resolve) => {
      recipientSocket.once("message:new", resolve);
    });

    await request(app)
      .post(`/api/v1/inbox/threads/${thread.body.id}/messages`)
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .send({ body: "Gerçek zamanlı merhaba" });

    const event = await receivedEvent;
    expect(event.threadId).toBe(thread.body.id);
    expect(event.message.body).toBe("Gerçek zamanlı merhaba");

    recipientSocket.disconnect();
  });

  it("rejects a socket connection without a valid token", async () => {
    await expect(connect("invalid-token")).rejects.toBeDefined();
  });
});
