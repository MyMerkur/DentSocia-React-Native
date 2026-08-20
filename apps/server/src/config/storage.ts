import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { env } from "./env";

export class StorageNotConfiguredError extends Error {}

const UPLOAD_URL_TTL_SECONDS = 5 * 60;

function isStorageConfigured(): boolean {
  return Boolean(env.R2_ENDPOINT && env.R2_ACCESS_KEY && env.R2_SECRET_KEY && env.R2_BUCKET);
}

export function ensureStorageConfigured(): void {
  if (!isStorageConfigured()) {
    throw new StorageNotConfiguredError("R2 depolama yapılandırılmamış");
  }
}

function getClient(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY,
      secretAccessKey: env.R2_SECRET_KEY,
    },
  });
}

const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

export function buildStorageKey(userId: string, documentType: string, contentType: string): string {
  const extension = contentType === "application/pdf" ? "pdf" : (contentType.split("/")[1] ?? "bin");
  return `kyc/${userId}/${documentType}/${randomUUID()}.${extension}`;
}

export function buildAvatarStorageKey(userId: string, contentType: string): string {
  const extension = contentType.split("/")[1] ?? "bin";
  return `avatars/${userId}/${randomUUID()}.${extension}`;
}

export function buildCaseImageStorageKey(userId: string, contentType: string): string {
  const extension = contentType.split("/")[1] ?? "bin";
  return `cases/${userId}/${randomUUID()}.${extension}`;
}

export async function createUploadUrl(key: string, contentType: string): Promise<string> {
  ensureStorageConfigured();
  const command = new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(getClient(), command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
}

export async function createDownloadUrl(key: string): Promise<string> {
  ensureStorageConfigured();
  const command = new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
}

export async function deleteObject(key: string): Promise<void> {
  ensureStorageConfigured();
  const command = new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key });
  await getClient().send(command);
}

export async function downloadObject(key: string): Promise<{ buffer: Buffer; contentType: string }> {
  ensureStorageConfigured();
  const command = new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key });
  const response = await getClient().send(command);
  if (!response.Body) {
    throw new Error("R2 nesnesi boş döndü");
  }
  const bytes = await response.Body.transformToByteArray();
  return { buffer: Buffer.from(bytes), contentType: response.ContentType ?? "application/octet-stream" };
}
