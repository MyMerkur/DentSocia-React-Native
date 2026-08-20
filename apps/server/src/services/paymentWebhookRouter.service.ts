import * as subscriptionRepo from "../repositories/subscription.repository";
import * as hubMembershipRepo from "../repositories/hubMembership.repository";
import * as subscriptionService from "./subscription.service";
import * as hubService from "./hub.service";
import * as orgDuesService from "./orgDues.service";
import type { SubscriptionWebhookPayload } from "./subscription.service";

// Single merchant-wide iyzico webhook route serves three independent domains: the app-wide
// Subscription collection (teaser_monthly/clinic_premium_monthly), per-Hub HubMembership
// records (DentSocia Hubs), and per-org OrgDuesSubscription records (dernek aidatı). Dispatch by
// looking up which collection actually owns the subscriptionReferenceCode BEFORE calling into
// any handler, so only one handler ever processes a given event — no shared-dedupeKey collision
// between domains. OrgDuesSubscription is checked last (its own handler already no-ops if the
// reference code isn't found there either, mirroring the Hub handler's existing behavior).
export async function routeSubscriptionWebhook(signatureHeader: string, payload: SubscriptionWebhookPayload): Promise<void> {
  const subscription = await subscriptionRepo.findByIyzicoSubscriptionReferenceCode(payload.subscriptionReferenceCode);
  if (subscription) {
    await subscriptionService.handleSubscriptionWebhook(signatureHeader, payload);
    return;
  }

  const hubMembership = await hubMembershipRepo.findByIyzicoSubscriptionReferenceCode(payload.subscriptionReferenceCode);
  if (hubMembership) {
    await hubService.handleHubMembershipWebhook(signatureHeader, payload);
    return;
  }

  await orgDuesService.handleDuesWebhook(signatureHeader, payload);
}
