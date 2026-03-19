import { Capacitor } from "@capacitor/core";

const IOS_PRODUCT_ID = "armpal_pro";
const LOCAL_PRO_KEY = "armpal_is_pro";

function isNativeIOS() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

function getStoreRuntime() {
  if (typeof window === "undefined") return null;
  const runtime = window.CdvPurchase;
  if (!runtime?.store) return null;
  return runtime;
}

async function waitForStoreRuntime(timeoutMs = 8000) {
  const existing = getStoreRuntime();
  if (existing) return existing;

  if (typeof window === "undefined") return null;

  return new Promise((resolve) => {
    let settled = false;
    const started = Date.now();

    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const tick = () => {
      const runtime = getStoreRuntime();
      if (runtime) return done(runtime);
      if (Date.now() - started >= timeoutMs) return done(null);
      setTimeout(tick, 150);
    };

    document.addEventListener(
      "deviceready",
      () => {
        const runtime = getStoreRuntime();
        if (runtime) done(runtime);
      },
      { once: true }
    );

    tick();
  });
}

let initialized = false;
let initPromise = null;
let purchaseResolver = null;
let onVerifiedGlobal = null;

export function getStoredProFlag() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LOCAL_PRO_KEY) === "1";
}

export function setStoredProFlag(value) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_PRO_KEY, value ? "1" : "0");
}

function mapProduct(product) {
  if (!product) return null;
  return {
    id: product.id,
    displayName: product.title || "ArmPal Pro",
    description: product.description || "",
    displayPrice: product.pricing?.price || product.price || "",
  };
}

function hasActiveEntitlement(product) {
  return !!product?.owned;
}

function resolvePurchase(result) {
  if (purchaseResolver) {
    purchaseResolver(result);
    purchaseResolver = null;
  }
}

function setupStoreHandlers(store) {
  store.when(IOS_PRODUCT_ID).approved((transaction) => {
    // Verification step: only verified flows unlock Pro.
    transaction.verify();
  });

  store.when(IOS_PRODUCT_ID).verified((receipt) => {
    receipt.finish();
    if (onVerifiedGlobal) onVerifiedGlobal();
    resolvePurchase({ status: "success", verified: true });
  });

  store.when(IOS_PRODUCT_ID).unverified(() => {
    resolvePurchase({ status: "verificationFailed", verified: false });
  });

  store.when(IOS_PRODUCT_ID).cancelled(() => {
    resolvePurchase({ status: "userCancelled" });
  });

  store.when(IOS_PRODUCT_ID).error(() => {
    resolvePurchase({ status: "failed", message: "Purchase failed. Please try again." });
  });
}

async function ensureInitialized(onVerified) {
  if (!isNativeIOS()) return { product: null, hasActiveEntitlement: getStoredProFlag() };

  const runtime = await waitForStoreRuntime();
  if (!runtime) {
    return {
      product: null,
      hasActiveEntitlement: false,
      error: "In-app purchases are unavailable on this device.",
    };
  }

  const { store, Platform } = runtime;
  onVerifiedGlobal = onVerified || onVerifiedGlobal;

  if (!initPromise) {
    initPromise = (async () => {
      if (!initialized) {
        setupStoreHandlers(store);
        store.register({
          id: IOS_PRODUCT_ID,
          type: runtime.ProductType.PAID_SUBSCRIPTION,
          platform: Platform.APPLE_APPSTORE,
        });
        await store.initialize([Platform.APPLE_APPSTORE]);
        initialized = true;
      }
      // Refresh receipts/products so owned state is current.
      await store.update();
      const product = store.get(IOS_PRODUCT_ID, Platform.APPLE_APPSTORE) || store.get(IOS_PRODUCT_ID);
      return {
        product: mapProduct(product),
        hasActiveEntitlement: hasActiveEntitlement(product),
      };
    })().finally(() => {
      initPromise = null;
    });
  }
  return initPromise;
}

export async function initializePurchaseStore(onVerified) {
  if (!isNativeIOS()) {
    return { product: null, hasActiveEntitlement: getStoredProFlag() };
  }
  return ensureInitialized(onVerified);
}

export async function purchaseProProduct() {
  if (!isNativeIOS()) {
    return { status: "unsupported" };
  }
  const init = await ensureInitialized();
  if (init?.error) return { status: "failed", message: init.error };

  const runtime = getStoreRuntime();
  const { store, Platform } = runtime;
  const product = store.get(IOS_PRODUCT_ID, Platform.APPLE_APPSTORE) || store.get(IOS_PRODUCT_ID);
  if (!product) {
    return { status: "failed", message: "ArmPal Pro product is unavailable right now." };
  }
  if (product.owned) {
    return { status: "success", verified: true };
  }

  return new Promise(async (resolve) => {
    purchaseResolver = resolve;
    setTimeout(() => {
      resolvePurchase({ status: "pending" });
    }, 45000);

    try {
      const offer = product.getOffer?.();
      if (offer?.order) {
        await offer.order();
      } else {
        await store.order(IOS_PRODUCT_ID);
      }
    } catch {
      resolvePurchase({ status: "failed", message: "Unable to start purchase. Please try again." });
    }
  });
}

export async function restorePurchases() {
  if (!isNativeIOS()) {
    return { hasActiveEntitlement: getStoredProFlag() };
  }
  const init = await ensureInitialized();
  if (init?.error) return { hasActiveEntitlement: false, error: init.error };

  const runtime = getStoreRuntime();
  const { store, Platform } = runtime;
  try {
    await store.restorePurchases();
    await store.update();
    const product = store.get(IOS_PRODUCT_ID, Platform.APPLE_APPSTORE) || store.get(IOS_PRODUCT_ID);
    return { hasActiveEntitlement: hasActiveEntitlement(product) };
  } catch {
    return { hasActiveEntitlement: false, error: "Restore failed. Please try again." };
  }
}

export async function checkEntitlements() {
  if (!isNativeIOS()) {
    return { hasActiveEntitlement: getStoredProFlag() };
  }
  const init = await ensureInitialized();
  if (init?.error) return { hasActiveEntitlement: false, error: init.error };

  const runtime = getStoreRuntime();
  const { store, Platform } = runtime;
  await store.update();
  const product = store.get(IOS_PRODUCT_ID, Platform.APPLE_APPSTORE) || store.get(IOS_PRODUCT_ID);
  return { hasActiveEntitlement: hasActiveEntitlement(product) };
}

export { IOS_PRODUCT_ID };
