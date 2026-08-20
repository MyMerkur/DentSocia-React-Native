import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";

const mockInitializeEventTicketCheckout = jest.fn();
const mockRetrieveJobCreditCheckoutResult = jest.fn();

jest.mock("./services/iyzico.service", () => ({
  initializeEventTicketCheckout: (...args: unknown[]) => mockInitializeEventTicketCheckout(...args),
  retrieveJobCreditCheckoutResult: (...args: unknown[]) => mockRetrieveJobCreditCheckoutResult(...args),
}));

let mongoServer: MongoMemoryServer;
let app: Express;

const ADMIN_EMAIL = "admin@dentsocia.dev";

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
  process.env.IYZICO_EVENT_TICKET_CALLBACK_URL = "https://example.com/api/v1/payments/iyzico/event-ticket-callback";
  process.env.ADMIN_EMAILS = ADMIN_EMAIL;

  const { connectDB } = await import("./config/db");
  await connectDB();
  app = (await import("./app")).default;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(() => {
  mockInitializeEventTicketCheckout.mockReset();
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

const validEventInput = {
  title: "Diş Hekimliği Kongresi 2026",
  description: "Yıllık kongre",
  location: "İstanbul Kongre Merkezi",
  startsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  endsAt: new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString(),
  ticketTypes: [{ name: "Standart", price: "150.00", capacity: 1 }],
};

// FEATURE_FLAGS.eventTicketing/payments=false gates most of these — see packages/shared-constants/src/featureFlags.ts
describe("Event ticketing endpoints", () => {
  it("rejects requests without an access token", async () => {
    expect((await request(app).post("/api/v1/events").send(validEventInput)).status).toBe(401);
    expect((await request(app).get("/api/v1/events")).status).toBe(401);
  });

  it.skip("rejects event creation for an unverified user", async () => {
    const { accessToken } = await registerAndLogin("organizer-unverified@dentsocia.dev");
    const response = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validEventInput);
    expect(response.status).toBe(403);
  });

  it.skip("allows an admin to create a platform event without employer KYC", async () => {
    const { accessToken } = await registerAndLogin(ADMIN_EMAIL, "hekim");
    const response = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validEventInput);
    expect(response.status).toBe(201);
    expect(response.body.title).toBe(validEventInput.title);
  });

  it.skip("completes the full ticket flow: create -> checkout -> callback -> attendee visible -> check-in", async () => {
    const { accessToken: organizerToken, userId: organizerId } = await registerAndLogin("organizer-flow@dentsocia.dev");
    await verifyOrgKyc(organizerId);

    const createRes = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${organizerToken}`)
      .send(validEventInput);
    expect(createRes.status).toBe(201);
    const eventId = createRes.body.id as string;
    const ticketTypeId = createRes.body.ticketTypes[0].id as string;

    const { accessToken: buyerToken } = await registerAndLogin("buyer-flow@dentsocia.dev", "hekim");

    mockInitializeEventTicketCheckout.mockResolvedValueOnce({
      token: "ticket-token-1",
      checkoutFormContent: "<form></form>",
    });

    const checkoutRes = await request(app)
      .post(`/api/v1/events/${eventId}/tickets/checkout`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ ticketTypeId, ...billingFields });
    expect(checkoutRes.status).toBe(201);

    mockRetrieveJobCreditCheckoutResult.mockResolvedValue({ paymentStatus: "SUCCESS", paymentId: "pay-1" });

    const callbackRes = await request(app)
      .post("/api/v1/payments/iyzico/event-ticket-callback")
      .type("form")
      .send({ token: "ticket-token-1" });
    expect(callbackRes.status).toBe(200);

    const myTicketsRes = await request(app)
      .get("/api/v1/events/tickets/mine")
      .set("Authorization", `Bearer ${buyerToken}`);
    expect(myTicketsRes.body).toHaveLength(1);
    const verificationCode = myTicketsRes.body[0].verificationCode as string;
    expect(myTicketsRes.body[0].qrCodeDataUrl).toContain("data:image");
    expect(myTicketsRes.body[0].checkedInAt).toBeNull();

    const attendeesRes = await request(app)
      .get(`/api/v1/events/${eventId}/attendees`)
      .set("Authorization", `Bearer ${organizerToken}`);
    expect(attendeesRes.status).toBe(200);
    expect(attendeesRes.body).toHaveLength(1);

    const attendeesForbidden = await request(app)
      .get(`/api/v1/events/${eventId}/attendees`)
      .set("Authorization", `Bearer ${buyerToken}`);
    expect(attendeesForbidden.status).toBe(403);

    const checkInRes = await request(app)
      .post("/api/v1/events/tickets/check-in")
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({ verificationCode });
    expect(checkInRes.status).toBe(200);
    expect(checkInRes.body.valid).toBe(true);
    expect(checkInRes.body.alreadyCheckedIn).toBe(false);

    const secondCheckInRes = await request(app)
      .post("/api/v1/events/tickets/check-in")
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({ verificationCode });
    expect(secondCheckInRes.status).toBe(200);
    expect(secondCheckInRes.body.alreadyCheckedIn).toBe(true);

    const checkInForbidden = await request(app)
      .post("/api/v1/events/tickets/check-in")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ verificationCode });
    expect(checkInForbidden.status).toBe(403);
  });

  it.skip("rejects checkout when the ticket type is sold out", async () => {
    const { accessToken: organizerToken, userId: organizerId } = await registerAndLogin("organizer-soldout@dentsocia.dev");
    await verifyOrgKyc(organizerId);

    const createRes = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${organizerToken}`)
      .send(validEventInput);
    const eventId = createRes.body.id as string;
    const ticketTypeId = createRes.body.ticketTypes[0].id as string;

    const { accessToken: buyerToken } = await registerAndLogin("buyer-soldout-1@dentsocia.dev", "hekim");
    mockInitializeEventTicketCheckout.mockResolvedValueOnce({
      token: "ticket-token-soldout",
      checkoutFormContent: "<form></form>",
    });
    await request(app)
      .post(`/api/v1/events/${eventId}/tickets/checkout`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ ticketTypeId, ...billingFields });

    mockRetrieveJobCreditCheckoutResult.mockResolvedValue({ paymentStatus: "SUCCESS", paymentId: "pay-1" });
    await request(app)
      .post("/api/v1/payments/iyzico/event-ticket-callback")
      .type("form")
      .send({ token: "ticket-token-soldout" });

    const { accessToken: secondBuyerToken } = await registerAndLogin("buyer-soldout-2@dentsocia.dev", "hekim");
    const secondCheckoutRes = await request(app)
      .post(`/api/v1/events/${eventId}/tickets/checkout`)
      .set("Authorization", `Bearer ${secondBuyerToken}`)
      .send({ ticketTypeId, ...billingFields });
    expect(secondCheckoutRes.status).toBe(409);
  });

  it.skip("marks a ticket oversold instead of paid when capacity runs out between checkout and payment", async () => {
    const { accessToken: organizerToken, userId: organizerId } = await registerAndLogin("organizer-oversell@dentsocia.dev");
    await verifyOrgKyc(organizerId);

    const createRes = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${organizerToken}`)
      .send(validEventInput);
    const eventId = createRes.body.id as string;
    const ticketTypeId = createRes.body.ticketTypes[0].id as string;

    // Both buyers start checkout while soldCount is still 0 (the soft check at checkout-start
    // cannot see the other's in-flight purchase) — simulates the race the audit flagged.
    const { accessToken: firstBuyerToken } = await registerAndLogin("buyer-oversell-1@dentsocia.dev", "hekim");
    mockInitializeEventTicketCheckout.mockResolvedValueOnce({
      token: "ticket-token-oversell-1",
      checkoutFormContent: "<form></form>",
    });
    await request(app)
      .post(`/api/v1/events/${eventId}/tickets/checkout`)
      .set("Authorization", `Bearer ${firstBuyerToken}`)
      .send({ ticketTypeId, ...billingFields });

    const { accessToken: secondBuyerToken } = await registerAndLogin("buyer-oversell-2@dentsocia.dev", "hekim");
    mockInitializeEventTicketCheckout.mockResolvedValueOnce({
      token: "ticket-token-oversell-2",
      checkoutFormContent: "<form></form>",
    });
    await request(app)
      .post(`/api/v1/events/${eventId}/tickets/checkout`)
      .set("Authorization", `Bearer ${secondBuyerToken}`)
      .send({ ticketTypeId, ...billingFields });

    mockRetrieveJobCreditCheckoutResult.mockResolvedValue({ paymentStatus: "SUCCESS", paymentId: "pay-first" });
    const firstCallbackRes = await request(app)
      .post("/api/v1/payments/iyzico/event-ticket-callback")
      .type("form")
      .send({ token: "ticket-token-oversell-1" });
    expect(firstCallbackRes.status).toBe(200);

    mockRetrieveJobCreditCheckoutResult.mockResolvedValue({ paymentStatus: "SUCCESS", paymentId: "pay-second" });
    const secondCallbackRes = await request(app)
      .post("/api/v1/payments/iyzico/event-ticket-callback")
      .type("form")
      .send({ token: "ticket-token-oversell-2" });
    expect(secondCallbackRes.status).toBe(200);

    const firstBuyerTickets = await request(app)
      .get("/api/v1/events/tickets/mine")
      .set("Authorization", `Bearer ${firstBuyerToken}`);
    expect(firstBuyerTickets.body).toHaveLength(1);

    const secondBuyerTickets = await request(app)
      .get("/api/v1/events/tickets/mine")
      .set("Authorization", `Bearer ${secondBuyerToken}`);
    expect(secondBuyerTickets.body).toHaveLength(0);

    const { EventTicketPurchaseModel } = await import("./models/EventTicketPurchase");
    const secondPurchase = await EventTicketPurchaseModel.findOne({ checkoutToken: "ticket-token-oversell-2" });
    expect(secondPurchase!.status).toBe("oversold");
    expect(secondPurchase!.iyzicoPaymentId).toBe("pay-second");
  });

  it.skip("does not issue a ticket when the payment fails", async () => {
    const { accessToken: organizerToken, userId: organizerId } = await registerAndLogin("organizer-fail@dentsocia.dev");
    await verifyOrgKyc(organizerId);

    const createRes = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${organizerToken}`)
      .send(validEventInput);
    const eventId = createRes.body.id as string;
    const ticketTypeId = createRes.body.ticketTypes[0].id as string;

    const { accessToken: buyerToken } = await registerAndLogin("buyer-fail@dentsocia.dev", "hekim");
    mockInitializeEventTicketCheckout.mockResolvedValueOnce({
      token: "ticket-token-fail",
      checkoutFormContent: "<form></form>",
    });
    await request(app)
      .post(`/api/v1/events/${eventId}/tickets/checkout`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ ticketTypeId, ...billingFields });

    mockRetrieveJobCreditCheckoutResult.mockResolvedValueOnce({ paymentStatus: "FAILURE", paymentId: null });
    await request(app).post("/api/v1/payments/iyzico/event-ticket-callback").type("form").send({ token: "ticket-token-fail" });

    const myTicketsRes = await request(app)
      .get("/api/v1/events/tickets/mine")
      .set("Authorization", `Bearer ${buyerToken}`);
    expect(myTicketsRes.body).toHaveLength(0);
  });
});
