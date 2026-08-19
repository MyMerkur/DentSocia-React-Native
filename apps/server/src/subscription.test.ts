import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";
import { createHmac } from "crypto";

const mockInitializeSubscriptionCheckout = jest.fn();
const mockRetrieveCheckoutFormResult = jest.fn();
const mockGetSubscriptionDetails = jest.fn();
const mockCancelIyzicoSubscription = jest.fn();

jest.mock("./services/iyzico.service", () => ({
  initializeSubscriptionCheckout: mockInitializeSubscriptionCheckout,
  retrieveCheckoutFormResult: mockRetrieveCheckoutFormResult,
  getSubscriptionDetails: mockGetSubscriptionDetails,
  cancelIyzicoSubscription: mockCancelIyzicoSubscription,
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
  process.env.IYZICO_PRICING_PLAN_REFERENCE_CODE = "test-plan-ref";
  process.env.IYZICO_CALLBACK_URL = "https://example.com/api/v1/payments/iyzico/callback";

  const { connectDB } = await import("./config/db");
  await connectDB();
  app = (await import("./app")).default;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(() => {
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

async function activateSubscription(accessToken: string, tokenSuffix: string) {
  const subscriptionReferenceCode = `sub-ref-${tokenSuffix}`;
  const customerReferenceCode = `cust-ref-${tokenSuffix}`;
  mockInitializeSubscriptionCheckout.mockResolvedValueOnce({
    token: `token-${tokenSuffix}`,
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
    .post("/api/v1/subscriptions/checkout")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ planCode: "teaser_monthly", ...billingFields });
  await request(app)
    .post("/api/v1/payments/iyzico/callback")
    .type("form")
    .send({ token: `token-${tokenSuffix}` });

  return { subscriptionReferenceCode, customerReferenceCode };
}

describe("Subscription endpoints", () => {
  it("rejects requests without an access token", async () => {
    const statusRes = await request(app).get("/api/v1/subscriptions/status");
    expect(statusRes.status).toBe(401);

    const checkoutRes = await request(app).post("/api/v1/subscriptions/checkout").send({ planCode: "teaser_monthly" });
    expect(checkoutRes.status).toBe(401);

    const cancelRes = await request(app).post("/api/v1/subscriptions/cancel");
    expect(cancelRes.status).toBe(401);
  });

  it("returns none status when a user has no subscription", async () => {
    const { accessToken } = await registerAndLogin("sub-none@dentsocia.dev");
    const response = await request(app).get("/api/v1/subscriptions/status").set("Authorization", `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("none");
  });

  it("rejects starting checkout when billing info has never been provided", async () => {
    const { accessToken } = await registerAndLogin("sub-missing-billing@dentsocia.dev");
    const response = await request(app)
      .post("/api/v1/subscriptions/checkout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ planCode: "teaser_monthly" });
    expect(response.status).toBe(400);
  });

  it("starts a checkout and returns the iyzico checkout form", async () => {
    mockInitializeSubscriptionCheckout.mockResolvedValueOnce({
      token: "token-checkout-1",
      checkoutFormContent: "<form></form>",
      tokenExpireTime: 1800,
    });

    const { accessToken } = await registerAndLogin("sub-checkout@dentsocia.dev");
    const response = await request(app)
      .post("/api/v1/subscriptions/checkout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ planCode: "teaser_monthly", ...billingFields });

    expect(response.status).toBe(201);
    expect(response.body.token).toBe("token-checkout-1");
    expect(response.body.checkoutFormContent).toBe("<form></form>");
  });

  it("activates a subscription on a successful checkout callback", async () => {
    const { accessToken } = await registerAndLogin("sub-callback@dentsocia.dev");
    await activateSubscription(accessToken, "callback-1");

    const statusRes = await request(app).get("/api/v1/subscriptions/status").set("Authorization", `Bearer ${accessToken}`);
    expect(statusRes.body.status).toBe("active");
    expect(statusRes.body.planCode).toBe("teaser_monthly");
  });

  it("returns 409 when starting a checkout while already active", async () => {
    const { accessToken } = await registerAndLogin("sub-already-active@dentsocia.dev");
    await activateSubscription(accessToken, "active-flow");

    const secondCheckout = await request(app)
      .post("/api/v1/subscriptions/checkout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ planCode: "teaser_monthly" });
    expect(secondCheckout.status).toBe(409);
  });

  it("processes a subscription webhook idempotently and only transitions state once per event", async () => {
    const { accessToken } = await registerAndLogin("sub-webhook@dentsocia.dev");
    const { subscriptionReferenceCode, customerReferenceCode } = await activateSubscription(accessToken, "webhook-1");

    mockGetSubscriptionDetails.mockResolvedValueOnce({
      referenceCode: subscriptionReferenceCode,
      subscriptionStatus: "UNPAID",
      startDate: "2026-01-01 00:00:00",
      endDate: "2026-02-01 00:00:00",
      customerReferenceCode,
    });

    const webhookPayload = {
      orderReferenceCode: "order-ref-webhook-1",
      customerReferenceCode,
      subscriptionReferenceCode,
      iyziReferenceCode: "iyzi-ref-webhook-1",
      iyziEventType: "subscription.order.failure",
    };
    const signature = buildWebhookSignature({ ...webhookPayload, eventType: webhookPayload.iyziEventType });

    const first = await request(app)
      .post("/api/v1/payments/iyzico/webhook")
      .set("x-iyz-signature-v3", signature)
      .send(webhookPayload);
    expect(first.status).toBe(200);

    const statusAfterFirst = await request(app)
      .get("/api/v1/subscriptions/status")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(statusAfterFirst.body.status).toBe("past_due");

    const second = await request(app)
      .post("/api/v1/payments/iyzico/webhook")
      .set("x-iyz-signature-v3", signature)
      .send(webhookPayload);
    expect(second.status).toBe(200);

    // 1 call during checkout callback + 1 call during the first (non-duplicate) webhook = 2.
    // A true duplicate delivery must not trigger a third re-query.
    expect(mockGetSubscriptionDetails).toHaveBeenCalledTimes(2);
  });

  it("rejects a webhook with an invalid signature without mutating any state", async () => {
    const { accessToken } = await registerAndLogin("sub-webhook-badsig@dentsocia.dev");
    const { subscriptionReferenceCode, customerReferenceCode } = await activateSubscription(accessToken, "badsig-1");

    const webhookPayload = {
      orderReferenceCode: "order-ref-badsig-1",
      customerReferenceCode,
      subscriptionReferenceCode,
      iyziReferenceCode: "iyzi-ref-badsig-1",
      iyziEventType: "subscription.order.success",
    };

    const response = await request(app)
      .post("/api/v1/payments/iyzico/webhook")
      .set("x-iyz-signature-v3", "0".repeat(64))
      .send(webhookPayload);
    expect(response.status).toBe(401);

    const statusRes = await request(app).get("/api/v1/subscriptions/status").set("Authorization", `Bearer ${accessToken}`);
    expect(statusRes.body.status).toBe("active");
  });

  it("rejects a candidate role from checking out the clinic premium plan", async () => {
    const { accessToken } = await registerAndLogin("sub-wrong-plan-candidate@dentsocia.dev", "hekim");
    const response = await request(app)
      .post("/api/v1/subscriptions/checkout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ planCode: "clinic_premium_monthly", ...billingFields });
    expect(response.status).toBe(403);
  });

  it("rejects an employer role from checking out the individual teaser plan", async () => {
    const { accessToken } = await registerAndLogin("sub-wrong-plan-employer@dentsocia.dev", "klinik");
    const response = await request(app)
      .post("/api/v1/subscriptions/checkout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ planCode: "teaser_monthly", ...billingFields });
    expect(response.status).toBe(403);
  });

  it("cancels an active subscription and returns 404 when nothing is left to cancel", async () => {
    mockCancelIyzicoSubscription.mockResolvedValueOnce(undefined);
    const { accessToken } = await registerAndLogin("sub-cancel@dentsocia.dev");
    await activateSubscription(accessToken, "cancel-1");

    const cancelRes = await request(app).post("/api/v1/subscriptions/cancel").set("Authorization", `Bearer ${accessToken}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe("canceled");

    const secondCancel = await request(app).post("/api/v1/subscriptions/cancel").set("Authorization", `Bearer ${accessToken}`);
    expect(secondCancel.status).toBe(404);
  });
});
