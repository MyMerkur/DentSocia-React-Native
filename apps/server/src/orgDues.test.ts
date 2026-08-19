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
  process.env.IYZICO_DUES_CALLBACK_URL = "https://example.com/api/v1/payments/iyzico/dues-callback";

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

// Affiliation now requires the org's approval (see user.test.ts for that flow itself) — these
// tests are about dues subscriptions, so membership is set up directly for brevity.
async function affiliate(accessToken: string, orgUserId: string) {
  const meRes = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);
  const { UserModel } = await import("./models/User");
  await UserModel.findByIdAndUpdate(meRes.body.id, { affiliatedOrgId: orgUserId });
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

async function createPlan(ownerToken: string, orgId: string) {
  const { UserModel } = await import("./models/User");
  await UserModel.findByIdAndUpdate(orgId, { kycLevel: 3 });

  mockCreateSubscriptionProductAndPlan.mockResolvedValueOnce({
    productReferenceCode: "dues-prod-ref-1",
    pricingPlanReferenceCode: "dues-plan-ref-1",
  });
  const response = await request(app)
    .post(`/api/v1/orgs/${orgId}/dues-plan`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Yıllık Aidat", price: "300.00", paymentInterval: "YEARLY" });
  return response.body as { id: string };
}

async function activateDues(memberToken: string, orgId: string, tokenSuffix: string) {
  const subscriptionReferenceCode = `dues-sub-ref-${tokenSuffix}`;
  const customerReferenceCode = `dues-cust-ref-${tokenSuffix}`;
  mockInitializeSubscriptionCheckout.mockResolvedValueOnce({
    token: `dues-token-${tokenSuffix}`,
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
    endDate: "2027-01-01 00:00:00",
    customerReferenceCode,
  });

  await request(app)
    .post(`/api/v1/orgs/${orgId}/dues/checkout`)
    .set("Authorization", `Bearer ${memberToken}`)
    .send(billingFields);
  await request(app)
    .post("/api/v1/payments/iyzico/dues-callback")
    .type("form")
    .send({ token: `dues-token-${tokenSuffix}` });

  return { subscriptionReferenceCode, customerReferenceCode };
}

// FEATURE_FLAGS.associationDues=false gates this whole router — see packages/shared-constants/src/featureFlags.ts
describe("Org dues endpoints", () => {
  it.skip("rejects dues plan creation for non-dernek accounts", async () => {
    const { accessToken, userId } = await registerAndLogin("dues-notdernek@dentsocia.dev", "klinik");
    const response = await request(app)
      .post(`/api/v1/orgs/${userId}/dues-plan`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ price: "100.00", paymentInterval: "MONTHLY" });
    expect(response.status).toBe(403);
  });

  it.skip("rejects dues plan creation for an unverified dernek account", async () => {
    const { accessToken, userId } = await registerAndLogin("dues-unverified@dentsocia.dev", "dernek");
    const response = await request(app)
      .post(`/api/v1/orgs/${userId}/dues-plan`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ price: "100.00", paymentInterval: "MONTHLY" });
    expect(response.status).toBe(403);
  });

  it.skip("rejects creating a second dues plan for the same org", async () => {
    const { accessToken: ownerToken, userId: orgId } = await registerAndLogin("dues-owner-1@dentsocia.dev", "dernek");
    await createPlan(ownerToken, orgId);

    const secondRes = await request(app)
      .post(`/api/v1/orgs/${orgId}/dues-plan`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ price: "300.00", paymentInterval: "YEARLY" });
    expect(secondRes.status).toBe(409);
  });

  it.skip("rejects dues checkout for a non-member", async () => {
    const { accessToken: ownerToken, userId: orgId } = await registerAndLogin("dues-owner-2@dentsocia.dev", "dernek");
    await createPlan(ownerToken, orgId);

    const { accessToken: outsiderToken } = await registerAndLogin("dues-outsider-2@dentsocia.dev");
    const response = await request(app)
      .post(`/api/v1/orgs/${orgId}/dues/checkout`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send(billingFields);
    expect(response.status).toBe(403);
  });

  it.skip("completes the full dues flow: plan -> checkout -> callback -> active -> visible to the owner", async () => {
    const { accessToken: ownerToken, userId: orgId } = await registerAndLogin("dues-owner-3@dentsocia.dev", "dernek");
    await createPlan(ownerToken, orgId);

    const { accessToken: memberToken } = await registerAndLogin("dues-member-3@dentsocia.dev");
    await affiliate(memberToken, orgId);
    await activateDues(memberToken, orgId, "flow-1");

    const subscribersRes = await request(app)
      .get(`/api/v1/orgs/${orgId}/dues/subscribers`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(subscribersRes.status).toBe(200);
    expect(subscribersRes.body.subscribers).toHaveLength(1);
    expect(subscribersRes.body.subscribers[0].status).toBe("active");

    const myStatusRes = await request(app)
      .get(`/api/v1/orgs/${orgId}/dues/mine`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(myStatusRes.status).toBe(200);
    expect(myStatusRes.body.status).toBe("active");

    const outsiderMyStatusRes = await request(app)
      .get(`/api/v1/orgs/${orgId}/dues/mine`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(outsiderMyStatusRes.status).toBe(200);
    expect(outsiderMyStatusRes.body.status).toBe("none");
  });

  it.skip("processes a past_due webhook and is idempotent on duplicate delivery", async () => {
    const { accessToken: ownerToken, userId: orgId } = await registerAndLogin("dues-owner-4@dentsocia.dev", "dernek");
    await createPlan(ownerToken, orgId);

    const { accessToken: memberToken } = await registerAndLogin("dues-member-4@dentsocia.dev");
    await affiliate(memberToken, orgId);
    const { subscriptionReferenceCode, customerReferenceCode } = await activateDues(memberToken, orgId, "webhook-1");

    mockGetSubscriptionDetails.mockResolvedValueOnce({
      referenceCode: subscriptionReferenceCode,
      subscriptionStatus: "UNPAID",
      startDate: "2026-01-01 00:00:00",
      endDate: "2027-01-01 00:00:00",
      customerReferenceCode,
    });
    const webhookPayload = {
      orderReferenceCode: "dues-order-ref-1",
      customerReferenceCode,
      subscriptionReferenceCode,
      iyziReferenceCode: "dues-iyzi-ref-1",
      iyziEventType: "subscription.order.failure",
    };
    const signature = buildWebhookSignature({ ...webhookPayload, eventType: webhookPayload.iyziEventType });

    const firstWebhook = await request(app)
      .post("/api/v1/payments/iyzico/webhook")
      .set("x-iyz-signature-v3", signature)
      .send(webhookPayload);
    expect(firstWebhook.status).toBe(200);

    const subscribersRes = await request(app)
      .get(`/api/v1/orgs/${orgId}/dues/subscribers`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(subscribersRes.body.subscribers[0].status).toBe("past_due");

    const secondWebhook = await request(app)
      .post("/api/v1/payments/iyzico/webhook")
      .set("x-iyz-signature-v3", signature)
      .send(webhookPayload);
    expect(secondWebhook.status).toBe(200);

    // 1 call during checkout callback + 1 call during the first (non-duplicate) webhook = 2.
    expect(mockGetSubscriptionDetails).toHaveBeenCalledTimes(2);
  });

  it.skip("cancels an active dues subscription via the iyzico subscription cancel call", async () => {
    const { accessToken: ownerToken, userId: orgId } = await registerAndLogin("dues-owner-5@dentsocia.dev", "dernek");
    await createPlan(ownerToken, orgId);

    const { accessToken: memberToken } = await registerAndLogin("dues-member-5@dentsocia.dev");
    await affiliate(memberToken, orgId);
    await activateDues(memberToken, orgId, "cancel-1");

    mockCancelIyzicoSubscription.mockResolvedValueOnce(undefined);
    const cancelRes = await request(app)
      .post(`/api/v1/orgs/${orgId}/dues/cancel`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe("canceled");
    expect(mockCancelIyzicoSubscription).toHaveBeenCalledTimes(1);

    const secondCancel = await request(app)
      .post(`/api/v1/orgs/${orgId}/dues/cancel`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(secondCancel.status).toBe(404);
  });
});
