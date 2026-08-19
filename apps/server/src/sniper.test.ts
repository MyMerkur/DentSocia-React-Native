import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";

const mockInitializeSniperCreditCheckout = jest.fn();
const mockRetrieveJobCreditCheckoutResult = jest.fn();

jest.mock("./services/iyzico.service", () => ({
  initializeSniperCreditCheckout: (...args: unknown[]) => mockInitializeSniperCreditCheckout(...args),
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
  process.env.IYZICO_SNIPER_CREDIT_CALLBACK_URL = "https://example.com/api/v1/payments/iyzico/sniper-credit-callback";

  const { connectDB } = await import("./config/db");
  await connectDB();
  app = (await import("./app")).default;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(() => {
  mockInitializeSniperCreditCheckout.mockReset();
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

async function setDiscoverableCandidate(
  userId: string,
  fields: { hiddenSearch?: boolean; openToWork?: boolean; specialties?: string[]; city?: string; experienceYears?: number },
) {
  const { UserModel } = await import("./models/User");
  await UserModel.findByIdAndUpdate(userId, {
    "career.openToWork": fields.openToWork ?? true,
    "career.hiddenSearch": fields.hiddenSearch ?? false,
    "career.experienceYears": fields.experienceYears ?? 5,
    "showcase.specialties": fields.specialties ?? ["Ortodonti"],
    "showcase.city": fields.city ?? "İstanbul",
    "showcase.displayName": "Test Aday",
  });
}

const billingFields = {
  identityNumber: "12345678901",
  phone: "5551234567",
  address: "Test Mah. Test Sok. No:1",
  city: "İstanbul",
};

describe("Sniper (B2B lead) endpoints", () => {
  it("rejects requests without an access token", async () => {
    expect((await request(app).get("/api/v1/sniper/candidates")).status).toBe(401);
    expect((await request(app).post("/api/v1/sniper/credits/checkout")).status).toBe(401);
  });

  it("rejects search and checkout for an unverified employer", async () => {
    const { accessToken } = await registerAndLogin("sniper-unverified@dentsocia.dev");
    expect((await request(app).get("/api/v1/sniper/candidates").set("Authorization", `Bearer ${accessToken}`)).status).toBe(
      403,
    );
    expect(
      (await request(app).post("/api/v1/sniper/credits/checkout").set("Authorization", `Bearer ${accessToken}`).send(
        billingFields,
      )).status,
    ).toBe(403);
  });

  it("excludes hidden-search and not-open-to-work candidates from search results", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin("sniper-search-emp@dentsocia.dev");
    await verifyOrgKyc(employerId);

    const { userId: hiddenCandidateId } = await registerAndLogin("sniper-hidden@dentsocia.dev", "hekim");
    await setDiscoverableCandidate(hiddenCandidateId, { hiddenSearch: true, specialties: ["Ortodonti"] });

    const { userId: notOpenCandidateId } = await registerAndLogin("sniper-notopen@dentsocia.dev", "hekim");
    await setDiscoverableCandidate(notOpenCandidateId, { openToWork: false, specialties: ["Ortodonti"] });

    const { userId: visibleCandidateId } = await registerAndLogin("sniper-visible@dentsocia.dev", "hekim");
    await setDiscoverableCandidate(visibleCandidateId, { specialties: ["Ortodonti"] });

    const searchRes = await request(app)
      .get("/api/v1/sniper/candidates?specialties=Ortodonti")
      .set("Authorization", `Bearer ${employerToken}`);
    expect(searchRes.status).toBe(200);
    const ids = searchRes.body.map((c: { candidateId: string }) => c.candidateId);
    expect(ids).toContain(visibleCandidateId);
    expect(ids).not.toContain(hiddenCandidateId);
    expect(ids).not.toContain(notOpenCandidateId);

    const visibleResult = searchRes.body.find((c: { candidateId: string }) => c.candidateId === visibleCandidateId);
    expect(visibleResult.unlocked).toBe(false);
    expect(visibleResult.displayName).toBeNull();
  });

  it("completes the full flow: buy credit -> unlock -> idempotent re-unlock -> insufficient balance -> hidden candidate 404", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin("sniper-flow-emp@dentsocia.dev");
    await verifyOrgKyc(employerId);

    const { userId: candidateId } = await registerAndLogin("sniper-flow-candidate@dentsocia.dev", "hekim");
    await setDiscoverableCandidate(candidateId, { specialties: ["Ortodonti"] });

    mockInitializeSniperCreditCheckout.mockResolvedValueOnce({
      token: "sniper-token-1",
      checkoutFormContent: "<form></form>",
    });
    const checkoutRes = await request(app)
      .post("/api/v1/sniper/credits/checkout")
      .set("Authorization", `Bearer ${employerToken}`)
      .send(billingFields);
    expect(checkoutRes.status).toBe(201);

    mockRetrieveJobCreditCheckoutResult.mockResolvedValue({ paymentStatus: "SUCCESS", paymentId: "pay-1" });
    await request(app).post("/api/v1/payments/iyzico/sniper-credit-callback").type("form").send({ token: "sniper-token-1" });

    const balanceAfterPurchase = await request(app)
      .get("/api/v1/sniper/credits/balance")
      .set("Authorization", `Bearer ${employerToken}`);
    expect(balanceAfterPurchase.body.balance).toBe(1);

    const unlockRes = await request(app)
      .post(`/api/v1/sniper/candidates/${candidateId}/unlock`)
      .set("Authorization", `Bearer ${employerToken}`);
    expect(unlockRes.status).toBe(200);
    expect(unlockRes.body.candidate.unlocked).toBe(true);
    expect(unlockRes.body.candidate.displayName).toBe("Test Aday");
    expect(unlockRes.body.thread.id).toBeDefined();

    const balanceAfterUnlock = await request(app)
      .get("/api/v1/sniper/credits/balance")
      .set("Authorization", `Bearer ${employerToken}`);
    expect(balanceAfterUnlock.body.balance).toBe(0);

    const secondUnlockRes = await request(app)
      .post(`/api/v1/sniper/candidates/${candidateId}/unlock`)
      .set("Authorization", `Bearer ${employerToken}`);
    expect(secondUnlockRes.status).toBe(200);

    const balanceAfterSecondUnlock = await request(app)
      .get("/api/v1/sniper/credits/balance")
      .set("Authorization", `Bearer ${employerToken}`);
    expect(balanceAfterSecondUnlock.body.balance).toBe(0);

    const { userId: otherCandidateId } = await registerAndLogin("sniper-flow-candidate-2@dentsocia.dev", "hekim");
    await setDiscoverableCandidate(otherCandidateId, { specialties: ["Ortodonti"] });
    const insufficientRes = await request(app)
      .post(`/api/v1/sniper/candidates/${otherCandidateId}/unlock`)
      .set("Authorization", `Bearer ${employerToken}`);
    expect(insufficientRes.status).toBe(402);

    const { userId: hiddenCandidateId } = await registerAndLogin("sniper-flow-hidden@dentsocia.dev", "hekim");
    await setDiscoverableCandidate(hiddenCandidateId, { hiddenSearch: true });
    const hiddenUnlockRes = await request(app)
      .post(`/api/v1/sniper/candidates/${hiddenCandidateId}/unlock`)
      .set("Authorization", `Bearer ${employerToken}`);
    expect(hiddenUnlockRes.status).toBe(404);
  });

  it("charges exactly one credit when concurrent requests unlock the same candidate", async () => {
    const { accessToken: employerToken, userId: employerId } = await registerAndLogin("sniper-race-emp@dentsocia.dev");
    await verifyOrgKyc(employerId);

    const { userId: candidateId } = await registerAndLogin("sniper-race-candidate@dentsocia.dev", "hekim");
    await setDiscoverableCandidate(candidateId, { specialties: ["Ortodonti"] });

    const { UserModel } = await import("./models/User");
    await UserModel.findByIdAndUpdate(employerId, { sniperCreditsBalance: 2 });

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post(`/api/v1/sniper/candidates/${candidateId}/unlock`).set("Authorization", `Bearer ${employerToken}`),
      ),
    );

    for (const response of responses) {
      expect(response.status).toBe(200);
    }

    const finalEmployer = await UserModel.findById(employerId);
    expect(finalEmployer!.sniperCreditsBalance).toBe(1);

    const { SniperUnlockModel } = await import("./models/SniperUnlock");
    const unlockCount = await SniperUnlockModel.countDocuments({ employerId, candidateId });
    expect(unlockCount).toBe(1);
  });
});
