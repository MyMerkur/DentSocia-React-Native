import { initializeApp, cert, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import * as deviceTokenRepo from "../repositories/deviceToken.repository";

export class PushNotConfiguredError extends Error {}

function isPushConfigured(): boolean {
  return Boolean(env.FCM_PROJECT_ID && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY);
}

let firebaseApp: App | null = null;

function getFirebaseApp(): App {
  if (!firebaseApp) {
    firebaseApp = initializeApp(
      {
        credential: cert({
          projectId: env.FCM_PROJECT_ID,
          clientEmail: env.FCM_CLIENT_EMAIL,
          privateKey: env.FCM_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      },
      "dentsocia-push",
    );
  }
  return firebaseApp;
}

interface SendPushParams {
  title: string;
  body: string;
}

const UNREGISTERED_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

export async function sendPushToUser(userId: string, params: SendPushParams): Promise<void> {
  if (!isPushConfigured()) {
    throw new PushNotConfiguredError("FCM yapılandırılmamış");
  }

  const tokens = await deviceTokenRepo.listTokensByUser(userId);
  if (tokens.length === 0) {
    return;
  }

  const app = getFirebaseApp();
  const response = await getMessaging(app).sendEachForMulticast({
    tokens: tokens.map((deviceToken) => deviceToken.token),
    notification: { title: params.title, body: params.body },
  });

  const invalidTokens = response.responses
    .map((result: { success: boolean; error?: { code?: string } }, index: number) =>
      !result.success && UNREGISTERED_ERROR_CODES.has(result.error?.code ?? "") ? tokens[index]!.token : null,
    )
    .filter((token: string | null): token is string => token !== null);

  if (invalidTokens.length > 0) {
    await deviceTokenRepo.removeTokens(invalidTokens);
    logger.info("push.tokens.pruned", { userId, count: invalidTokens.length });
  }
}
