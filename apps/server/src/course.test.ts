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

async function registerAndLogin(email: string) {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "Supersecret123", role: "hekim" });
  return { accessToken: response.body.accessToken as string, userId: response.body.user.id as string };
}

async function setKycLevel(userId: string, level: number) {
  const { UserModel } = await import("./models/User");
  await UserModel.findByIdAndUpdate(userId, { kycLevel: level });
}

async function createCourse(accessToken: string, title = "Endodontide İleri Teknikler") {
  const response = await request(app)
    .post("/api/v1/courses")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ title });
  return response.body.id as string;
}

// FEATURE_FLAGS.instructorEconomy=false gates this whole router — see packages/shared-constants/src/featureFlags.ts
describe("Course/Enrollment/Certificate endpoints", () => {
  it("rejects requests without an access token", async () => {
    expect((await request(app).post("/api/v1/courses").send({ title: "x" })).status).toBe(401);
    expect((await request(app).get("/api/v1/courses")).status).toBe(401);
    expect((await request(app).get("/api/v1/enrollments/mine")).status).toBe(401);
  });

  it.skip("rejects course creation for a non-instructor", async () => {
    const { accessToken } = await registerAndLogin("course-non-instructor@dentsocia.dev");
    const response = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Bir Kurs" });
    expect(response.status).toBe(403);
  });

  it.skip("creates and lists courses for an instructor", async () => {
    const { accessToken, userId } = await registerAndLogin("course-instructor@dentsocia.dev");
    await setKycLevel(userId, 4);

    const created = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Endodontide İleri Teknikler", description: "İçerik", specialties: ["Endodonti"] });
    expect(created.status).toBe(201);

    const listed = await request(app).get("/api/v1/courses").set("Authorization", `Bearer ${accessToken}`);
    expect(listed.body.courses.some((c: { id: string }) => c.id === created.body.id)).toBe(true);

    const mine = await request(app).get("/api/v1/courses/mine").set("Authorization", `Bearer ${accessToken}`);
    expect(mine.body.courses).toHaveLength(1);
  });

  it.skip("rejects enrollment for a user below kycLevel 1", async () => {
    const { accessToken: instructorToken, userId: instructorId } = await registerAndLogin("course-enroll-instructor@dentsocia.dev");
    await setKycLevel(instructorId, 4);
    const courseId = await createCourse(instructorToken);

    const { accessToken: participantToken } = await registerAndLogin("course-enroll-unverified@dentsocia.dev");
    const response = await request(app)
      .post(`/api/v1/courses/${courseId}/enroll`)
      .set("Authorization", `Bearer ${participantToken}`);
    expect(response.status).toBe(403);
  });

  it.skip("rejects an instructor enrolling in their own course", async () => {
    const { accessToken, userId } = await registerAndLogin("course-self-enroll@dentsocia.dev");
    await setKycLevel(userId, 4);
    const courseId = await createCourse(accessToken);

    const response = await request(app)
      .post(`/api/v1/courses/${courseId}/enroll`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(response.status).toBe(400);
  });

  it.skip("rejects duplicate enrollment", async () => {
    const { accessToken: instructorToken, userId: instructorId } = await registerAndLogin("course-dup-instructor@dentsocia.dev");
    await setKycLevel(instructorId, 4);
    const courseId = await createCourse(instructorToken);

    const { accessToken: participantToken, userId: participantId } = await registerAndLogin("course-dup-participant@dentsocia.dev");
    await setKycLevel(participantId, 1);

    const first = await request(app)
      .post(`/api/v1/courses/${courseId}/enroll`)
      .set("Authorization", `Bearer ${participantToken}`);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/v1/courses/${courseId}/enroll`)
      .set("Authorization", `Bearer ${participantToken}`);
    expect(second.status).toBe(409);
  });

  it.skip("rejects a non-owner from viewing or completing enrollments", async () => {
    const { accessToken: instructorToken, userId: instructorId } = await registerAndLogin("course-owner-instructor@dentsocia.dev");
    await setKycLevel(instructorId, 4);
    const courseId = await createCourse(instructorToken);

    const { accessToken: outsiderToken, userId: outsiderId } = await registerAndLogin("course-owner-outsider@dentsocia.dev");
    await setKycLevel(outsiderId, 4);

    const listRes = await request(app)
      .get(`/api/v1/courses/${courseId}/enrollments`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(listRes.status).toBe(403);

    const completeRes = await request(app)
      .post(`/api/v1/courses/${courseId}/enrollments/000000000000000000000000/complete`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(completeRes.status).toBe(403);
  });

  it.skip("supports the full enroll -> complete -> certificate -> verify flow", async () => {
    const { accessToken: instructorToken, userId: instructorId } = await registerAndLogin("course-flow-instructor@dentsocia.dev");
    await setKycLevel(instructorId, 4);
    const courseId = await createCourse(instructorToken);

    const { accessToken: participantToken, userId: participantId } = await registerAndLogin("course-flow-participant@dentsocia.dev");
    await setKycLevel(participantId, 1);

    const enrollRes = await request(app)
      .post(`/api/v1/courses/${courseId}/enroll`)
      .set("Authorization", `Bearer ${participantToken}`);
    expect(enrollRes.status).toBe(201);
    const enrollmentId = enrollRes.body.id as string;

    const enrollmentsRes = await request(app)
      .get(`/api/v1/courses/${courseId}/enrollments`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(enrollmentsRes.body.enrollments).toHaveLength(1);

    const completeRes = await request(app)
      .post(`/api/v1/courses/${courseId}/enrollments/${enrollmentId}/complete`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.status).toBe("completed");

    const secondCompleteRes = await request(app)
      .post(`/api/v1/courses/${courseId}/enrollments/${enrollmentId}/complete`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(secondCompleteRes.status).toBe(400);

    const myEnrollmentsRes = await request(app)
      .get("/api/v1/enrollments/mine")
      .set("Authorization", `Bearer ${participantToken}`);
    expect(myEnrollmentsRes.status).toBe(200);
    const enrollment = myEnrollmentsRes.body.enrollments[0];
    expect(enrollment.status).toBe("completed");
    expect(enrollment.certificate).not.toBeNull();
    expect(enrollment.certificate.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(enrollment.certificate.verificationUrl).toBe(enrollment.certificate.verificationCode);

    const verifyRes = await request(app).get(
      `/api/v1/certificates/verify/${enrollment.certificate.verificationCode}`,
    );
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
    expect(verifyRes.body.courseTitle).toBe("Endodontide İleri Teknikler");
    // Neither account set a showcase displayName — this public, unauthenticated endpoint must
    // never fall back to the full email, only its local part.
    expect(verifyRes.body.participantName).toBe("course-flow-participant");
    expect(verifyRes.body.instructorName).toBe("course-flow-instructor");

    const unknownVerifyRes = await request(app).get("/api/v1/certificates/verify/unknown-code");
    expect(unknownVerifyRes.body.valid).toBe(false);
  });
});
