import { randomUUID } from "crypto";
import { EMPLOYER_ROLES } from "@dentsocia/shared-constants";
import { findUserById, incrementSniperCreditsBalance } from "../repositories/user.repository";
import * as sniperCreditRepo from "../repositories/sniperCreditPurchase.repository";
import * as iyzicoService from "./iyzico.service";
import { iyzicoConfig } from "../config/iyzico";
import { resolveBillingInfo } from "./subscription.service";
import { HttpError } from "../utils/httpError";

interface BillingInfoInput {
  identityNumber?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  zipCode?: string;
}

export async function requireVerifiedEmployer(userId: string) {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError("Kullanıcı bulunamadı", 404);
  }
  if (!(EMPLOYER_ROLES as readonly string[]).includes(user.role)) {
    throw new HttpError("Bu özellik sadece klinik/firma/dernek hesapları için kullanılabilir", 403);
  }
  if (user.kycLevel < 3) {
    throw new HttpError("Bu özellik için kurumsal doğrulama (Level 3) gerekli", 403);
  }
  return user;
}

export async function startSniperCreditCheckout(userId: string, billingInfo: BillingInfoInput) {
  await requireVerifiedEmployer(userId);
  const { user, merged } = await resolveBillingInfo(userId, billingInfo);

  const purchase = await sniperCreditRepo.create({
    userId,
    checkoutConversationId: randomUUID(),
    price: iyzicoConfig.sniperCreditPrice,
  });

  const displayName = user.showcase.displayName || user.email;
  const [name, ...rest] = displayName.trim().split(/\s+/);
  const surname = rest.length > 0 ? rest.join(" ") : "Kullanıcı";

  let checkout;
  try {
    checkout = await iyzicoService.initializeSniperCreditCheckout({
      conversationId: purchase._id.toString(),
      price: iyzicoConfig.sniperCreditPrice,
      callbackUrl: iyzicoConfig.sniperCreditCallbackUrl,
      buyer: {
        id: userId,
        name: name || "Kullanıcı",
        surname,
        email: user.email,
        gsmNumber: merged.phone,
        identityNumber: merged.identityNumber,
        registrationAddress: merged.address,
        city: merged.city,
        country: merged.country,
      },
    });
  } catch (error) {
    await sniperCreditRepo.markFailedIfPending(purchase._id.toString());
    throw error;
  }

  await sniperCreditRepo.setCheckoutToken(purchase._id.toString(), checkout.token);

  return {
    purchaseId: purchase._id.toString(),
    token: checkout.token,
    checkoutFormContent: checkout.checkoutFormContent,
  };
}

export async function handleSniperCreditCallback(token: string): Promise<void> {
  const purchase = await sniperCreditRepo.findByCheckoutToken(token);
  if (!purchase) {
    throw new HttpError("Satın alma kaydı bulunamadı", 404);
  }
  if (purchase.status !== "pending_checkout") {
    return;
  }

  const result = await iyzicoService.retrieveJobCreditCheckoutResult(token);

  if (result.paymentStatus === "SUCCESS") {
    const updated = await sniperCreditRepo.markPaidIfPending(purchase._id.toString(), result.paymentId ?? "");
    if (updated) {
      await incrementSniperCreditsBalance(purchase.userId.toString(), updated.creditsGranted);
    }
  } else {
    await sniperCreditRepo.markFailedIfPending(purchase._id.toString());
  }
}

export async function getSniperCreditBalance(userId: string): Promise<{ balance: number }> {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError("Kullanıcı bulunamadı", 404);
  }
  return { balance: user.sniperCreditsBalance };
}
