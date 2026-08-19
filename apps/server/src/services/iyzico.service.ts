import { env } from "../config/env";
import { buildAuthorizationHeaders, ensureIyzicoConfigured } from "../config/iyzico";
import { HttpError } from "../utils/httpError";
import { logger } from "../utils/logger";

export interface IyzicoCustomer {
  name: string;
  surname: string;
  email: string;
  gsmNumber: string;
  identityNumber: string;
  billingAddress: {
    address: string;
    contactName: string;
    city: string;
    country: string;
    zipCode?: string;
  };
}

export interface InitializeCheckoutParams {
  conversationId: string;
  pricingPlanReferenceCode: string;
  callbackUrl: string;
  customer: IyzicoCustomer;
}

export interface InitializeCheckoutResult {
  token: string;
  checkoutFormContent: string;
  tokenExpireTime: number;
}

export interface CheckoutFormResult {
  status: string;
  referenceCode: string | null;
  subscriptionStatus: string | null;
  customerReferenceCode: string | null;
}

export interface SubscriptionDetailsResult {
  referenceCode: string;
  subscriptionStatus: string;
  startDate: string | null;
  endDate: string | null;
  customerReferenceCode: string | null;
}

type IyzicoEnvelope<T> = { status?: string; errorCode?: string; errorMessage?: string; data?: T } & Partial<T>;

async function iyzicoRequest<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  ensureIyzicoConfigured();
  const requestBody = body ? JSON.stringify(body) : "";
  const authHeaders = buildAuthorizationHeaders(path, requestBody);

  let response: Response;
  try {
    response = await fetch(`${env.IYZICO_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...authHeaders,
      },
      body: requestBody || undefined,
    });
  } catch (error) {
    logger.error("iyzico.request.network_error", {
      path,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new HttpError("Ödeme sağlayıcısına ulaşılamadı", 502);
  }

  const json = (await response.json().catch(() => null)) as IyzicoEnvelope<T> | null;

  if (!response.ok || !json || json.status === "failure") {
    logger.error("iyzico.request.failed", {
      path,
      httpStatus: response.status,
      errorCode: json?.errorCode,
    });
    throw new HttpError("Ödeme sağlayıcısı isteği başarısız", 502);
  }

  return (json.data ?? json) as T;
}

export async function initializeSubscriptionCheckout(params: InitializeCheckoutParams): Promise<InitializeCheckoutResult> {
  return iyzicoRequest<InitializeCheckoutResult>("POST", "/v2/subscription/checkoutform/initialize", {
    locale: "tr",
    conversationId: params.conversationId,
    pricingPlanReferenceCode: params.pricingPlanReferenceCode,
    subscriptionInitialStatus: "ACTIVE",
    callbackUrl: params.callbackUrl,
    customer: params.customer,
  });
}

export async function retrieveCheckoutFormResult(token: string): Promise<CheckoutFormResult> {
  return iyzicoRequest<CheckoutFormResult>("GET", `/v2/subscription/checkoutform/${encodeURIComponent(token)}`);
}

export async function getSubscriptionDetails(subscriptionReferenceCode: string): Promise<SubscriptionDetailsResult> {
  return iyzicoRequest<SubscriptionDetailsResult>(
    "GET",
    `/v2/subscription/subscriptions/${encodeURIComponent(subscriptionReferenceCode)}`,
  );
}

export async function cancelIyzicoSubscription(subscriptionReferenceCode: string): Promise<void> {
  await iyzicoRequest<unknown>("POST", `/v2/subscription/subscriptions/${encodeURIComponent(subscriptionReferenceCode)}/cancel`);
}

export interface JobCreditBuyer {
  id: string;
  name: string;
  surname: string;
  email: string;
  gsmNumber: string;
  identityNumber: string;
  registrationAddress: string;
  city: string;
  country: string;
}

export interface InitializeJobCreditCheckoutParams {
  conversationId: string;
  price: string;
  callbackUrl: string;
  buyer: JobCreditBuyer;
}

export interface JobCreditCheckoutInitResult {
  token: string;
  checkoutFormContent: string;
}

// iyzico Checkout Form (CF) — one-time payment product, distinct from the Subscription v2 API
// above but the same IYZWSv2 auth scheme, so iyzicoRequest() is reused unchanged.
export async function initializeJobCreditCheckout(
  params: InitializeJobCreditCheckoutParams,
): Promise<JobCreditCheckoutInitResult> {
  const address = {
    address: params.buyer.registrationAddress,
    contactName: `${params.buyer.name} ${params.buyer.surname}`,
    city: params.buyer.city,
    country: params.buyer.country,
  };

  return iyzicoRequest<JobCreditCheckoutInitResult>("POST", "/payment/iyzipos/checkoutform/initialize/auth/ecom", {
    locale: "tr",
    conversationId: params.conversationId,
    price: params.price,
    paidPrice: params.price,
    currency: "TRY",
    callbackUrl: params.callbackUrl,
    paymentGroup: "PRODUCT",
    buyer: params.buyer,
    shippingAddress: address,
    billingAddress: address,
    basketItems: [
      {
        id: "job-posting-credit",
        price: params.price,
        name: "DENTSOCIA İlan Yayın Kredisi",
        category1: "İlan",
        itemType: "VIRTUAL",
      },
    ],
  });
}

export interface JobCreditCheckoutDetailResult {
  paymentStatus: string;
  paymentId: string | null;
}

export async function retrieveJobCreditCheckoutResult(token: string): Promise<JobCreditCheckoutDetailResult> {
  return iyzicoRequest<JobCreditCheckoutDetailResult>("POST", "/payment/iyzipos/checkoutform/auth/ecom/detail", {
    locale: "tr",
    token,
  });
}

export interface InitializeEventTicketCheckoutParams {
  conversationId: string;
  price: string;
  callbackUrl: string;
  buyer: JobCreditBuyer;
  ticketLabel: string;
}

// Structural twin of initializeJobCreditCheckout — same one-time CF endpoint, different basket
// item label. Kept separate rather than generalizing the job-credit function, to avoid touching
// its tested call site for a purely cosmetic shared-helper win.
export async function initializeEventTicketCheckout(
  params: InitializeEventTicketCheckoutParams,
): Promise<JobCreditCheckoutInitResult> {
  const address = {
    address: params.buyer.registrationAddress,
    contactName: `${params.buyer.name} ${params.buyer.surname}`,
    city: params.buyer.city,
    country: params.buyer.country,
  };

  return iyzicoRequest<JobCreditCheckoutInitResult>("POST", "/payment/iyzipos/checkoutform/initialize/auth/ecom", {
    locale: "tr",
    conversationId: params.conversationId,
    price: params.price,
    paidPrice: params.price,
    currency: "TRY",
    callbackUrl: params.callbackUrl,
    paymentGroup: "PRODUCT",
    buyer: params.buyer,
    shippingAddress: address,
    billingAddress: address,
    basketItems: [
      {
        id: "event-ticket",
        price: params.price,
        name: params.ticketLabel,
        category1: "Etkinlik",
        itemType: "VIRTUAL",
      },
    ],
  });
}

export interface InitializeSniperCreditCheckoutParams {
  conversationId: string;
  price: string;
  callbackUrl: string;
  buyer: JobCreditBuyer;
}

// Structural twin of initializeJobCreditCheckout — same one-time CF endpoint, different basket
// item. Kept separate rather than generalizing the job-credit function, to avoid touching its
// tested call site for a purely cosmetic shared-helper win (same reasoning as the event-ticket twin).
export async function initializeSniperCreditCheckout(
  params: InitializeSniperCreditCheckoutParams,
): Promise<JobCreditCheckoutInitResult> {
  const address = {
    address: params.buyer.registrationAddress,
    contactName: `${params.buyer.name} ${params.buyer.surname}`,
    city: params.buyer.city,
    country: params.buyer.country,
  };

  return iyzicoRequest<JobCreditCheckoutInitResult>("POST", "/payment/iyzipos/checkoutform/initialize/auth/ecom", {
    locale: "tr",
    conversationId: params.conversationId,
    price: params.price,
    paidPrice: params.price,
    currency: "TRY",
    callbackUrl: params.callbackUrl,
    paymentGroup: "PRODUCT",
    buyer: params.buyer,
    shippingAddress: address,
    billingAddress: address,
    basketItems: [
      {
        id: "sniper-credit",
        price: params.price,
        name: "DENTSOCIA Keskin Nişancı Kredisi",
        category1: "Lead",
        itemType: "VIRTUAL",
      },
    ],
  });
}

export interface CreateSubscriptionProductAndPlanParams {
  name: string;
  price: string;
  currencyCode?: string;
  paymentInterval?: "MONTHLY" | "YEARLY";
}

export interface CreateSubscriptionProductAndPlanResult {
  productReferenceCode: string;
  pricingPlanReferenceCode: string;
}

// Dynamic per-Hub product/plan provisioning for DentSocia Hubs paid membership — unlike the
// app-wide teaser_monthly/clinic_premium_monthly plans (fixed, created once via iyzico's
// dashboard/support, referenced via env), each paid Hub gets its own iyzico product + monthly
// recurring pricing plan created here at Hub-creation time. Same IYZWSv2 auth, iyzicoRequest()
// reused unchanged.
export async function createSubscriptionProductAndPlan(
  params: CreateSubscriptionProductAndPlanParams,
): Promise<CreateSubscriptionProductAndPlanResult> {
  const product = await iyzicoRequest<{ referenceCode: string }>("POST", "/v2/subscription/products", {
    locale: "tr",
    name: params.name,
  });

  const pricingPlan = await iyzicoRequest<{ referenceCode: string }>(
    "POST",
    `/v2/subscription/products/${encodeURIComponent(product.referenceCode)}/pricing-plans`,
    {
      locale: "tr",
      name: params.name,
      price: params.price,
      currencyCode: params.currencyCode ?? "TRY",
      paymentInterval: params.paymentInterval ?? "MONTHLY",
      paymentIntervalCount: 1,
      planPaymentType: "RECURRING",
    },
  );

  return {
    productReferenceCode: product.referenceCode,
    pricingPlanReferenceCode: pricingPlan.referenceCode,
  };
}
