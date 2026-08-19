import { randomUUID } from "crypto";
import { EMPLOYER_ROLES, CANDIDATE_ROLES } from "@dentsocia/shared-constants";
import { findUserById, updateBillingInfo } from "../repositories/user.repository";
import * as subscriptionRepo from "../repositories/subscription.repository";
import * as paymentEventRepo from "../repositories/paymentEvent.repository";
import * as iyzicoService from "./iyzico.service";
import { iyzicoConfig, verifyWebhookSignature } from "../config/iyzico";
import { encryptField, decryptField } from "../utils/fieldEncryption";
import { HttpError } from "../utils/httpError";
import { logger } from "../utils/logger";
import {
  notifySubscriptionActivated,
  notifySubscriptionRenewed,
  notifySubscriptionPaymentFailed,
  notifySubscriptionCanceled,
} from "./notification.service";
import type { SubscriptionPlanCode, SubscriptionStatus } from "../models/Subscription";

const PLAN_CODE_ALLOWED_ROLES: Record<SubscriptionPlanCode, readonly string[]> = {
  teaser_monthly: CANDIDATE_ROLES,
  clinic_premium_monthly: EMPLOYER_ROLES,
};

function getPricingPlanReferenceCode(planCode: SubscriptionPlanCode): string {
  return planCode === "clinic_premium_monthly"
    ? iyzicoConfig.clinicPremiumPricingPlanReferenceCode
    : iyzicoConfig.pricingPlanReferenceCode;
}

interface BillingInfoInput {
  identityNumber?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  zipCode?: string;
}

export interface SubscriptionWebhookPayload {
  orderReferenceCode: string;
  customerReferenceCode: string;
  subscriptionReferenceCode: string;
  iyziReferenceCode: string;
  iyziEventType: string;
}

function serializeStatus(subscription: Awaited<ReturnType<typeof subscriptionRepo.findLatestByUser>>) {
  if (!subscription) {
    return { status: "none" as const, planCode: null, currentPeriodEnd: null, canceledAt: null };
  }
  return {
    status: subscription.status,
    planCode: subscription.planCode,
    currentPeriodEnd: subscription.currentPeriodEnd,
    canceledAt: subscription.canceledAt,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code: number }).code === 11000);
}

export async function processIdempotent(params: {
  dedupeKey: string;
  source: "checkout_callback" | "subscription_webhook";
  eventType: string;
  subscriptionId?: string | null;
  iyzicoSubscriptionReferenceCode?: string;
  iyzicoOrderReferenceCode?: string;
  process: () => Promise<void>;
}): Promise<void> {
  let event;
  try {
    event = await paymentEventRepo.create({
      dedupeKey: params.dedupeKey,
      source: params.source,
      eventType: params.eventType,
      subscriptionId: params.subscriptionId,
      iyzicoSubscriptionReferenceCode: params.iyzicoSubscriptionReferenceCode,
      iyzicoOrderReferenceCode: params.iyzicoOrderReferenceCode,
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
    const existing = await paymentEventRepo.findByDedupeKey(params.dedupeKey);
    if (!existing) {
      throw error;
    }
    if (existing.resultStatus === "applied") {
      logger.info("payment.event.duplicate_ignored", { dedupeKey: params.dedupeKey });
      return;
    }
    event = existing;
  }

  try {
    await params.process();
    await paymentEventRepo.markResult(event._id.toString(), "applied");
  } catch (error) {
    await paymentEventRepo.markResult(event._id.toString(), "error", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export function mapIyzicoStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "UNPAID":
      return "past_due";
    case "CANCELED":
      return "canceled";
    case "EXPIRED":
      return "expired";
    case "PENDING":
      return "pending_checkout";
    default:
      return "past_due";
  }
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await subscriptionRepo.findLatestByUser(userId);
  return subscription?.status === "active";
}

export async function getSubscriptionStatus(userId: string) {
  const subscription = await subscriptionRepo.findLatestByUser(userId);
  return serializeStatus(subscription);
}

export async function resolveBillingInfo(userId: string, provided: BillingInfoInput) {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError("Kullanıcı bulunamadı", 404);
  }

  const merged = {
    identityNumber:
      provided.identityNumber ??
      (user.billingInfo.identityNumberEncrypted ? decryptField(user.billingInfo.identityNumberEncrypted) : ""),
    phone: provided.phone ?? user.billingInfo.phone,
    address: provided.address ?? user.billingInfo.address,
    city: provided.city ?? user.billingInfo.city,
    country: provided.country ?? user.billingInfo.country ?? "Türkiye",
    zipCode: provided.zipCode ?? user.billingInfo.zipCode,
  };

  if (!merged.identityNumber || !merged.phone || !merged.address || !merged.city) {
    throw new HttpError("Abonelik başlatmak için fatura bilgileri (TC kimlik no, telefon, adres, şehir) eksik", 400);
  }

  const hasNewData =
    provided.identityNumber !== undefined ||
    provided.phone !== undefined ||
    provided.address !== undefined ||
    provided.city !== undefined ||
    provided.country !== undefined ||
    provided.zipCode !== undefined;

  if (hasNewData) {
    await updateBillingInfo(userId, {
      identityNumberEncrypted: encryptField(merged.identityNumber),
      phone: merged.phone,
      address: merged.address,
      city: merged.city,
      country: merged.country,
      zipCode: merged.zipCode,
    });
  }

  return { user, merged };
}

export async function startSubscriptionCheckout(userId: string, planCode: SubscriptionPlanCode, billingInfo: BillingInfoInput) {
  const { user, merged } = await resolveBillingInfo(userId, billingInfo);
  if (!PLAN_CODE_ALLOWED_ROLES[planCode].includes(user.role)) {
    throw new HttpError("Bu abonelik planı hesap türünüz için uygun değil", 403);
  }
  if (await hasActiveSubscription(userId)) {
    throw new HttpError("Zaten aktif bir aboneliğiniz var", 409);
  }

  const subscription = await subscriptionRepo.create({
    userId,
    planCode,
    checkoutConversationId: randomUUID(),
  });

  const displayName = user.showcase.displayName || user.email;
  const [name, ...rest] = displayName.trim().split(/\s+/);
  const surname = rest.length > 0 ? rest.join(" ") : "Kullanıcı";

  let checkout;
  try {
    checkout = await iyzicoService.initializeSubscriptionCheckout({
      conversationId: subscription._id.toString(),
      pricingPlanReferenceCode: getPricingPlanReferenceCode(planCode),
      callbackUrl: iyzicoConfig.callbackUrl,
      customer: {
        name: name || "Kullanıcı",
        surname,
        email: user.email,
        gsmNumber: merged.phone,
        identityNumber: merged.identityNumber,
        billingAddress: {
          address: merged.address,
          contactName: displayName,
          city: merged.city,
          country: merged.country,
          zipCode: merged.zipCode,
        },
      },
    });
  } catch (error) {
    await subscriptionRepo.updateStatus(subscription._id.toString(), {
      status: "canceled",
      cancelReason: "checkout_init_failed",
    });
    throw error;
  }

  await subscriptionRepo.setCheckoutToken(subscription._id.toString(), checkout.token);

  return {
    subscriptionId: subscription._id.toString(),
    token: checkout.token,
    checkoutFormContent: checkout.checkoutFormContent,
  };
}

export async function handleCheckoutCallback(token: string): Promise<void> {
  await processIdempotent({
    dedupeKey: `callback:${token}`,
    source: "checkout_callback",
    eventType: "checkout.callback",
    process: async () => {
      const subscription = await subscriptionRepo.findByCheckoutToken(token);
      if (!subscription) {
        throw new HttpError("Abonelik kaydı bulunamadı", 404);
      }

      const result = await iyzicoService.retrieveCheckoutFormResult(token);

      if (result.status === "success" && result.subscriptionStatus === "ACTIVE" && result.referenceCode) {
        const details = await iyzicoService.getSubscriptionDetails(result.referenceCode);
        await subscriptionRepo.updateStatus(subscription._id.toString(), {
          status: "active",
          iyzicoSubscriptionReferenceCode: result.referenceCode,
          iyzicoCustomerReferenceCode: result.customerReferenceCode ?? "",
          iyzicoPricingPlanReferenceCode: getPricingPlanReferenceCode(subscription.planCode),
          currentPeriodStart: details.startDate ? new Date(details.startDate) : new Date(),
          currentPeriodEnd: details.endDate ? new Date(details.endDate) : null,
        });
        await notifySubscriptionActivated(subscription.userId.toString());
      } else {
        await subscriptionRepo.updateStatus(subscription._id.toString(), {
          status: "canceled",
          cancelReason: "checkout_failed",
        });
      }
    },
  });
}

export async function handleSubscriptionWebhook(signatureHeader: string, payload: SubscriptionWebhookPayload): Promise<void> {
  const verified = verifyWebhookSignature({
    signatureHeader,
    eventType: payload.iyziEventType,
    subscriptionReferenceCode: payload.subscriptionReferenceCode,
    orderReferenceCode: payload.orderReferenceCode,
    customerReferenceCode: payload.customerReferenceCode,
  });
  if (!verified) {
    logger.warn("payment.webhook.invalid_signature", { eventType: payload.iyziEventType });
    throw new HttpError("Geçersiz webhook imzası", 401);
  }

  await processIdempotent({
    dedupeKey: `webhook:${payload.iyziReferenceCode}`,
    source: "subscription_webhook",
    eventType: payload.iyziEventType,
    iyzicoSubscriptionReferenceCode: payload.subscriptionReferenceCode,
    iyzicoOrderReferenceCode: payload.orderReferenceCode,
    process: async () => {
      const subscription = await subscriptionRepo.findByIyzicoSubscriptionReferenceCode(payload.subscriptionReferenceCode);
      if (!subscription) {
        logger.warn("payment.webhook.subscription_not_found", {
          subscriptionReferenceCode: payload.subscriptionReferenceCode,
        });
        return;
      }

      const details = await iyzicoService.getSubscriptionDetails(payload.subscriptionReferenceCode);
      const previousStatus = subscription.status;
      const nextStatus = mapIyzicoStatus(details.subscriptionStatus);

      await subscriptionRepo.updateStatus(subscription._id.toString(), {
        status: nextStatus,
        currentPeriodEnd: details.endDate ? new Date(details.endDate) : subscription.currentPeriodEnd,
        lastPaymentFailureReason:
          payload.iyziEventType === "subscription.order.failure" ? "payment_failed" : subscription.lastPaymentFailureReason,
      });

      if (nextStatus !== previousStatus) {
        if (nextStatus === "active" && payload.iyziEventType === "subscription.order.success") {
          await notifySubscriptionRenewed(subscription.userId.toString());
        } else if (nextStatus === "past_due" || payload.iyziEventType === "subscription.order.failure") {
          await notifySubscriptionPaymentFailed(subscription.userId.toString());
        }
      }
    },
  });
}

export async function cancelSubscription(userId: string) {
  const subscription = await subscriptionRepo.findLatestByUser(userId);
  if (!subscription || subscription.status !== "active") {
    throw new HttpError("Aktif bir aboneliğiniz yok", 404);
  }
  await iyzicoService.cancelIyzicoSubscription(subscription.iyzicoSubscriptionReferenceCode);
  const updated = await subscriptionRepo.updateStatus(subscription._id.toString(), {
    status: "canceled",
    canceledAt: new Date(),
    cancelReason: "user_requested",
  });
  await notifySubscriptionCanceled(userId);
  return serializeStatus(updated);
}
