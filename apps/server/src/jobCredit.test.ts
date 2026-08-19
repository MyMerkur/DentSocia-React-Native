import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";

const mockInitializeJobCreditCheckout = jest.fn();
const mockRetrieveJobCreditCheckoutResult = jest.fn();

jest.mock("./services/iyzico.service", () => ({
  initializeJobCreditCheckout: (...args: unknown[]) => mockInitializeJobCreditCheckout(...args),
  retrieveJobCreditCheckoutResult: (...args: unknown[]) => mockRetrieveJobCreditCheckoutResult(...args),
}));

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
  process.env.IYZICO_SECRET_KEY = "test-iyzico-secret";
  process.env.IYZICO_MERCHANT_ID = "123456";
  process.env.IYZICO_JOB_CREDIT_PRICE = "199.90";
  process.env.IYZICO_JOB_CREDIT_CALLBACK_URL = "https://example.com/api/v1/payments/iyzico/job-credit-callback";

  const { connectDB } = await import("./config/db");
  await connectDB();
  app = (await import("./app")).default;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(() => {
  mockInitializeJobCreditCheckout.mockReset();
  mockRetrieveJobCreditCheckoutResult.mockReset();
});

async function registerAndLogin(email: string, role = "klinik") {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "Supersecret123", role });
  return { accessToken: response.body.accessToken as string, userId: response.body.user.id as string };
}

async function verifyOrgKyc(userId: string) {
  const { UserModel } = await import("./models/User");
  await UserModel.findByIdAndUpdate(userId, { kycLevel: 3 });
}

const billingFields = {
  identityNumber: "12345678901",
  phone: "5551234567",
  address: "Test Mah. Test Sok. No:1",
  city: "İstanbul",
};

describe("Job credit endpoints", () => {
  it("rejects requests without an access token", async () => {
    expect((await request(app).post("/api/v1/job-credits/checkout")).status).toBe(401);
    expect((await request(app).get("/api/v1/job-credits/balance")).status).toBe(401);
  });

  it("rejects checkout for an unverified employer", async () => {
    const { accessToken } = await registerAndLogin("credit-unverified@dentsocia.dev");
    const response = await request(app)
      .post("/api/v1/job-credits/checkout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(billingFields);
    expect(response.status).toBe(403);
  });

  it("completes the full checkout -> callback -> balance flow and is idempotent", async () => {
    const { accessToken, userId } = await registerAndLogin("credit-flow@dentsocia.dev");
    await verifyOrgKyc(userId);

    mockInitializeJobCreditCheckout.mockResolvedValueOnce({
      token: "credit-token-1",
      checkoutFormContent: "<form></form>",
    });

    const checkoutRes = await request(app)
      .post("/api/v1/job-credits/checkout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(billingFields);
    expect(checkoutRes.status).toBe(201);
    expect(checkoutRes.body.token).toBe("credit-token-1");

    mockRetrieveJobCreditCheckoutResult.mockResolvedValue({ paymentStatus: "SUCCESS", paymentId: "pay-1" });

    const firstCallback = await request(app)
      .post("/api/v1/payments/iyzico/job-credit-callback")
      .type("form")
      .send({ token: "credit-token-1" });
    expect(firstCallback.status).toBe(200);

    const balanceRes = await request(app)
      .get("/api/v1/job-credits/balance")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(balanceRes.body.balance).toBe(1);

    const secondCallback = await request(app)
      .post("/api/v1/payments/iyzico/job-credit-callback")
      .type("form")
      .send({ token: "credit-token-1" });
    expect(secondCallback.status).toBe(200);

    const balanceAfterDuplicate = await request(app)
      .get("/api/v1/job-credits/balance")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(balanceAfterDuplicate.body.balance).toBe(1);
  });

  it("does not grant a credit when the payment fails", async () => {
    const { accessToken, userId } = await registerAndLogin("credit-fail@dentsocia.dev");
    await verifyOrgKyc(userId);

    mockInitializeJobCreditCheckout.mockResolvedValueOnce({
      token: "credit-token-fail",
      checkoutFormContent: "<form></form>",
    });
    await request(app)
      .post("/api/v1/job-credits/checkout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(billingFields);

    mockRetrieveJobCreditCheckoutResult.mockResolvedValueOnce({ paymentStatus: "FAILURE", paymentId: null });

    await request(app).post("/api/v1/payments/iyzico/job-credit-callback").type("form").send({ token: "credit-token-fail" });

    const balanceRes = await request(app)
      .get("/api/v1/job-credits/balance")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(balanceRes.body.balance).toBe(0);
  });
});
