import { Capacitor, registerPlugin } from "@capacitor/core";

const IOS_PRODUCT_ID = "armpal_pro";
const LOCAL_PRO_KEY = "armpal_is_pro";

const PurchasePlugin = registerPlugin("PurchasePlugin");

function isNativeIOS() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export function getStoredProFlag() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LOCAL_PRO_KEY) === "1";
}

export function setStoredProFlag(value) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_PRO_KEY, value ? "1" : "0");
}

export async function initializePurchaseStore() {
  if (!isNativeIOS()) {
    return { product: null, hasActiveEntitlement: getStoredProFlag() };
  }
  const result = await PurchasePlugin.initialize({ productIds: [IOS_PRODUCT_ID] });
  return {
    product: result?.product || null,
    hasActiveEntitlement: !!result?.hasActiveEntitlement,
  };
}

export async function purchaseProProduct() {
  if (!isNativeIOS()) {
    return { status: "unsupported" };
  }
  return PurchasePlugin.purchase({ productId: IOS_PRODUCT_ID });
}

export async function restorePurchases() {
  if (!isNativeIOS()) {
    return { hasActiveEntitlement: getStoredProFlag() };
  }
  return PurchasePlugin.restorePurchases({ productId: IOS_PRODUCT_ID });
}

export async function checkEntitlements() {
  if (!isNativeIOS()) {
    return { hasActiveEntitlement: getStoredProFlag() };
  }
  return PurchasePlugin.checkEntitlements({ productId: IOS_PRODUCT_ID });
}

export { IOS_PRODUCT_ID };
