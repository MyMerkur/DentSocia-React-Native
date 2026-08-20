import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { MICRO_COMPETENCY_TAGS } from "@dentsocia/shared-constants";
import { env } from "../config/env";
import { downloadObject } from "../config/storage";
import { findUserById } from "../repositories/user.repository";
import { HttpError } from "../utils/httpError";

export class AiDraftNotConfiguredError extends Error {}

const INSTRUCTOR_KYC_LEVEL = 4;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

const CaseDraftSchema = z.object({
  title: z.string().min(3).max(150),
  description: z.string().max(2000),
  specialties: z.array(z.enum(MICRO_COMPETENCY_TAGS)).max(8),
});

export type CaseDraft = z.infer<typeof CaseDraftSchema>;

const CASE_DRAFT_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    specialties: { type: "array", items: { type: "string", enum: MICRO_COMPETENCY_TAGS } },
  },
  required: ["title", "description", "specialties"],
  additionalProperties: false,
} as const;

interface GenerateCaseDraftInput {
  storageKeys: string[];
  captionText?: string;
}

export async function generateCaseDraft(userId: string, input: GenerateCaseDraftInput): Promise<CaseDraft> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AiDraftNotConfiguredError("ANTHROPIC_API_KEY yapılandırılmamış");
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError("Kullanıcı bulunamadı", 404);
  }
  if (user.kycLevel < INSTRUCTOR_KYC_LEVEL) {
    throw new HttpError("Bu özellik sadece eğitmenler için kullanılabilir", 403);
  }

  const imageBlocks = await Promise.all(
    input.storageKeys.map(async (storageKey) => {
      const { buffer, contentType } = await downloadObject(storageKey);
      if (!SUPPORTED_IMAGE_TYPES.has(contentType)) {
        throw new HttpError(`Desteklenmeyen görsel içerik tipi: ${contentType}`, 400);
      }
      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: contentType as "image/jpeg" | "image/png",
          data: buffer.toString("base64"),
        },
      };
    }),
  );

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          {
            type: "text",
            text: `Bu görseller ve açıklama bir Instagram diş/sağlık vakası paylaşımına ait.${
              input.captionText ? ` Instagram açıklaması: "${input.captionText}"` : ""
            } Bu içerikten DENTSOCIA platformu için uygun bir vaka başlığı, açıklaması ve ilgili yetkinlik etiketleri öner.`,
          },
        ],
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: CASE_DRAFT_JSON_SCHEMA },
    },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI taslak yanıtında metin bulunamadı");
  }

  return CaseDraftSchema.parse(JSON.parse(textBlock.text));
}
