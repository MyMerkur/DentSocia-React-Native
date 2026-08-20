import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";
import { createHmac } from "crypto";

const mockCreateSubscriptionProductAndPlan = jest.fn();
const mockInitializeSubscriptionCheckout = jest.fn();
const mockRetrieveCheckoutFormResult = jest.fn();
const mockGetSubscriptionDetails = jest.fn();
const mockCancelIyzicoSubscription = jest.fn();

jest.mock("./services/iyzico.service", () => ({
  createSubscriptionProductAndPlan: (...args: unknown[]) => mockCreateSubscriptionProductAndPlan(...args),
  initializeSubscriptionCheckout: (...args: unknown[]) => mockInitializeSubscriptionCheckout(...args),
  retrieveCheckoutFormResult: (...args: unknown[]) => mockRetrieveCheckoutFormResult(...args),
  getSubscriptionDetails: (...args: unknown[]) => mockGetSubscriptionDetails(...args),
  cancelIyzicoSubscription: (...args: unknown[]) => mockCancelIyzicoSubscription(...args),
}));

const IYZICO_SECRET_KEY = "test-iyzico-secret";
const IYZICO_MERCHANT_ID = "123456";

let mongoServer: MongoMemoryServer;
let app: Express;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.ATLAS_URI_DEV = mongoServer.getUri();
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  process.env.AUTH_RATE_LIMIT_MAX = "1000";
  process.env.PAYMENT_RATE_LIMIT_MAX = "1000";
  process.env.FIELD_ENCRYPTION_KEY = "test-field-encryption-key-32-bytes!!";
  process.env.IYZICO_API_KEY = "test-api-key";
  process.env.IYZICO_SECRET_KEY = IYZICO_SECRET_KEY;
  process.env.IYZICO_MERCHANT_ID = IYZICO_MERCHANT_ID;
  process.env.IYZICO_HUB_MEMBERSHIP_CALLBACK_URL = "https://example.com/api/v1/payments/iyzico/hub-membership-callback";

  const { connectDB } = await import("./config/db");
  await connectDB();
  app = (await import("./app")).default;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(() => {
  mockCreateSubscriptionProductAndPlan.mockReset();
  mockInitializeSubscriptionCheckout.mockReset();
  mockRetrieveCheckoutFormResult.mockReset();
  mockGetSubscriptionDetails.mockReset();
  mockCancelIyzicoSubscription.mockReset();
});

async function registerAndLogin(email: string, role = "hekim") {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "Supersecret123", role });
  return { accessToken: response.body.accessToken as string, userId: response.body.user.id as string };
}

async function setKycLevel(userId: string, level: number) {
  const { UserModel } = await import("./models/User");
  await UserModel.findByIdAndUpdate(userId, { kycLevel: level });
}

const billingFields = {
  identityNumber: "12345678901",
  phone: "5551234567",
  address: "Test Mah. Test Sok. No:1",
  city: "İstanbul",
};

function buildWebhookSignature(params: {
  eventType: string;
  subscriptionReferenceCode: string;
  orderReferenceCode: string;
  customerReferenceCode: string;
}) {
  const message =
    IYZICO_MERCHANT_ID +
    IYZICO_SECRET_KEY +
    params.eventType +
    params.subscriptionReferenceCode +
    params.orderReferenceCode +
    params.customerReferenceCode;
  return createHmac("sha256", IYZICO_SECRET_KEY).update(message).digest("hex");
}

async function createFreeHub(accessToken: string, name = "Endodonti Meraklıları") {
  const response = await request(app)
    .post("/api/v1/hubs")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name, type: "free" });
  return response.body as { id: string };
}

async function createPaidHub(accessToken: string, name = "Premium İmplant Kulübü") {
  mockCreateSubscriptionProductAndPlan.mockResolvedValueOnce({
    productReferenceCode: "prod-ref-1",
    pricingPlanReferenceCode: "plan-ref-1",
  });
  const response = await request(app)
    .post("/api/v1/hubs")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name, type: "paid", price: "49.90" });
  return response.body as { id: string };
}

async function activateHubMembership(accessToken: string, hubId: string, tokenSuffix: string) {
  const subscriptionReferenceCode = `hub-sub-ref-${tokenSuffix}`;
  const customerReferenceCode = `hub-cust-ref-${tokenSuffix}`;
  mockInitializeSubscriptionCheckout.mockResolvedValueOnce({
    token: `hub-token-${tokenSuffix}`,
    checkoutFormContent: "<form></form>",
    tokenExpireTime: 1800,
  });
  mockRetrieveCheckoutFormResult.mockResolvedValueOnce({
    status: "success",
    referenceCode: subscriptionReferenceCode,
    subscriptionStatus: "ACTIVE",
    customerReferenceCode,
  });
  mockGetSubscriptionDetails.mockResolvedValueOnce({
    referenceCode: subscriptionReferenceCode,
    subscriptionStatus: "ACTIVE",
    startDate: "2026-01-01 00:00:00",
    endDate: "2026-02-01 00:00:00",
    customerReferenceCode,
  });

  await request(app)
    .post(`/api/v1/hubs/${hubId}/membership/checkout`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(billingFields);
  await request(app)
    .post("/api/v1/payments/iyzico/hub-membership-callback")
    .type("form")
    .send({ token: `hub-token-${tokenSuffix}` });

  return { subscriptionReferenceCode, customerReferenceCode };
}

describe("Hub endpoints", () => {
  it("rejects requests without an access token", async () => {
    expect((await request(app).post("/api/v1/hubs").send({ name: "X", type: "free" })).status).toBe(401);
    expect((await request(app).get("/api/v1/hubs")).status).toBe(401);
  });

  it("requires Level 1 KYC to create a free hub", async () => {
    const { accessToken } = await registerAndLogin("hub-unverified@dentsocia.dev");
    const response = await request(app)
      .post("/api/v1/hubs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Ortodonti Sohbet", type: "free" });
    expect(response.status).toBe(403);
  });

  it("requires Level 4 KYC to create a paid hub, and provisions an iyzico product/plan on success", async () => {
    const { accessToken, userId } = await registerAndLogin("hub-instructor@dentsocia.dev");
    await setKycLevel(userId, 1);

    const belowInstructor = await request(app)
      .post("/api/v1/hubs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Cerrahi Elit", type: "paid", price: "99.90" });
    expect(belowInstructor.status).toBe(403);

    await setKycLevel(userId, 4);
    mockCreateSubscriptionProductAndPlan.mockResolvedValueOnce({
      productReferenceCode: "prod-ref-x",
      pricingPlanReferenceCode: "plan-ref-x",
    });
    const created = await request(app)
      .post("/api/v1/hubs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Cerrahi Elit", type: "paid", price: "99.90" });
    expect(created.status).toBe(201);
    expect(created.body.type).toBe("paid");
    expect(mockCreateSubscriptionProductAndPlan).toHaveBeenCalledWith({ name: "Cerrahi Elit", price: "99.90" });
  });

  it("joins a free hub, increments memberCount, and rejects a duplicate join", async () => {
    const { accessToken: ownerToken, userId: ownerId } = await registerAndLogin("hub-owner@dentsocia.dev");
    await setKycLevel(ownerId, 1);
    const hub = await createFreeHub(ownerToken);

    const { accessToken: memberToken, userId: memberId } = await registerAndLogin("hub-member@dentsocia.dev");
    await setKycLevel(memberId, 1);

    const joinRes = await request(app)
      .post(`/api/v1/hubs/${hub.id}/join`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(joinRes.status).toBe(201);
    expect(joinRes.body.memberCount).toBe(1);
    expect(joinRes.body.isMember).toBe(true);

    const duplicateJoin = await request(app)
      .post(`/api/v1/hubs/${hub.id}/join`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(duplicateJoin.status).toBe(409);
  });

  it("rejects checkout for a free hub and rejects join for a paid hub", async () => {
    const { accessToken: ownerToken, userId: ownerId } = await registerAndLogin("hub-mismatch-owner@dentsocia.dev");
    await setKycLevel(ownerId, 1);
    const freeHub = await createFreeHub(ownerToken, "Ücretsiz Hub");

    const { accessToken: memberToken } = await registerAndLogin("hub-mismatch-member@dentsocia.dev");
    const checkoutOnFree = await request(app)
      .post(`/api/v1/hubs/${freeHub.id}/membership/checkout`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send(billingFields);
    expect(checkoutOnFree.status).toBe(400);

    await setKycLevel(ownerId, 4);
    const paidHub = await createPaidHub(ownerToken, "Ücretli Hub");
    const joinOnPaid = await request(app)
      .post(`/api/v1/hubs/${paidHub.id}/join`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(joinOnPaid.status).toBe(400);
  });

  it("completes the paid membership checkout -> callback flow and processes renewal/failure webhooks idempotently", async () => {
    const { accessToken: ownerToken, userId: ownerId } = await registerAndLogin("hub-paid-owner@dentsocia.dev");
    await setKycLevel(ownerId, 4);
    const hub = await createPaidHub(ownerToken);

    const { accessToken: memberToken } = await registerAndLogin("hub-paid-member@dentsocia.dev");
    const { subscriptionReferenceCode, customerReferenceCode } = await activateHubMembership(memberToken, hub.id, "flow-1");

    const detail = await request(app).get(`/api/v1/hubs/${hub.id}`).set("Authorization", `Bearer ${memberToken}`);
    expect(detail.body.isMember).toBe(true);
    expect(detail.body.memberCount).toBe(1);

    mockGetSubscriptionDetails.mockResolvedValueOnce({
      referenceCode: subscriptionReferenceCode,
      subscriptionStatus: "UNPAID",
      startDate: "2026-01-01 00:00:00",
      endDate: "2026-02-01 00:00:00",
      customerReferenceCode,
    });
    const webhookPayload = {
      orderReferenceCode: "hub-order-ref-1",
      customerReferenceCode,
      subscriptionReferenceCode,
      iyziReferenceCode: "hub-iyzi-ref-1",
      iyziEventType: "subscription.order.failure",
    };
    const signature = buildWebhookSignature({ ...webhookPayload, eventType: webhookPayload.iyziEventType });

    const firstWebhook = await request(app)
      .post("/api/v1/payments/iyzico/webhook")
      .set("x-iyz-signature-v3", signature)
      .send(webhookPayload);
    expect(firstWebhook.status).toBe(200);

    const secondWebhook = await request(app)
      .post("/api/v1/payments/iyzico/webhook")
      .set("x-iyz-signature-v3", signature)
      .send(webhookPayload);
    expect(secondWebhook.status).toBe(200);

    // 1 call during checkout callback + 1 call during the first (non-duplicate) webhook = 2.
    expect(mockGetSubscriptionDetails).toHaveBeenCalledTimes(2);
  });

  it("leaves a free hub (decrements memberCount) and a paid hub (cancels the iyzico subscription)", async () => {
    const { accessToken: ownerToken, userId: ownerId } = await registerAndLogin("hub-leave-owner@dentsocia.dev");
    await setKycLevel(ownerId, 4);
    const freeHub = await createFreeHub(ownerToken, "Ayrılınabilir Ücretsiz Hub");
    const paidHub = await createPaidHub(ownerToken, "Ayrılınabilir Ücretli Hub");

    const { accessToken: memberToken } = await registerAndLogin("hub-leave-member@dentsocia.dev");
    await request(app).post(`/api/v1/hubs/${freeHub.id}/join`).set("Authorization", `Bearer ${memberToken}`);
    await activateHubMembership(memberToken, paidHub.id, "leave-1");

    mockCancelIyzicoSubscription.mockResolvedValueOnce(undefined);

    const leaveFree = await request(app)
      .post(`/api/v1/hubs/${freeHub.id}/leave`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(leaveFree.status).toBe(200);

    const leavePaid = await request(app)
      .post(`/api/v1/hubs/${paidHub.id}/leave`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(leavePaid.status).toBe(200);
    expect(mockCancelIyzicoSubscription).toHaveBeenCalledTimes(1);

    const freeDetail = await request(app).get(`/api/v1/hubs/${freeHub.id}`).set("Authorization", `Bearer ${memberToken}`);
    expect(freeDetail.body.memberCount).toBe(0);
    expect(freeDetail.body.isMember).toBe(false);
  });

  it("requires active membership to post or read a hub's feed, and paginates posts once a member", async () => {
    const { accessToken: ownerToken, userId: ownerId } = await registerAndLogin("hub-feed-owner@dentsocia.dev");
    await setKycLevel(ownerId, 1);
    const hub = await createFreeHub(ownerToken, "Vaka Paylaşım Hub");

    const { accessToken: outsiderToken } = await registerAndLogin("hub-feed-outsider@dentsocia.dev");
    const forbiddenPost = await request(app)
      .post(`/api/v1/hubs/${hub.id}/posts`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ text: "Merhaba" });
    expect(forbiddenPost.status).toBe(403);
    const forbiddenFeed = await request(app)
      .get(`/api/v1/hubs/${hub.id}/posts`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(forbiddenFeed.status).toBe(403);

    await request(app).post(`/api/v1/hubs/${hub.id}/join`).set("Authorization", `Bearer ${outsiderToken}`);

    const created = await request(app)
      .post(`/api/v1/hubs/${hub.id}/posts`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ text: "Merhaba Hub!" });
    expect(created.status).toBe(201);
    expect(created.body.text).toBe("Merhaba Hub!");

    const feed = await request(app)
      .get(`/api/v1/hubs/${hub.id}/posts`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(feed.status).toBe(200);
    expect(feed.body.posts).toHaveLength(1);
    expect(feed.body.posts[0].text).toBe("Merhaba Hub!");
  });
});
