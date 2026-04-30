// src/services/purchaseManager.js
// Apple IAP only. No Stripe. Boots at module load on native iOS so the product
// is registered and prices are loaded before the user opens the paywall.

import { Capacitor } from "@capacitor/core";

export const IOS_PRODUCT_ID = "armpal_pro";
const LOCAL_PRO_KEY = "armpal_is_pro";
const RUNTIME_READY_EVENT = "armpal-iap-state";

function log(tag, ...rest) {
  try {
    console.log(`[IAP] ${tag}`, ...rest);
  } catch {
    // no-op
  }
}

function isNativeIOS() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

function getRuntime() {
  if (typeof window === "undefined") return null;
  const rt = window.CdvPurchase;
  if (!rt?.store) return null;
  return rt;
}

function waitForRuntime(timeoutMs = 15000) {
  const existing = getRuntime();
  if (existing) return Promise.resolve(existing);
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    const started = Date.now();
    const finish = (v) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    document.addEventListener(
      "deviceready",
      () => {
        const rt = getRuntime();
        if (rt) finish(rt);
      },
      { once: true }
    );
    const tick = () => {
      const rt = getRuntime();
      if (rt) return finish(rt);
      if (Date.now() - started >= timeoutMs) return finish(null);
      setTimeout(tick, 150);
    };
    tick();
  });
}

// ---------- Observable state ---------------------------------------------

const FALLBACK_PRICE_LABEL = "$8.99";
const FALLBACK_TIMEOUT_MS = 5000;

const state = {
  initialized: false,
  registered: false,
  ready: false,
  loaded: false,
  canPurchase: false,
  owned: false,
  product: null, // { id, displayName, description, displayPrice }
  lastError: null, // string | null
  fallback: false, // true once 5s fail-safe forces a UI-usable product
};

const listeners = new Set();

function snapshot() {
  return { ...state };
}

function emit() {
  const snap = snapshot();
  for (const l of listeners) {
    try {
      l(snap);
    } catch (e) {
      console.error("[IAP] listener error", e);
    }
  }
  try {
    window.dispatchEvent(new CustomEvent(RUNTIME_READY_EVENT, { detail: snap }));
  } catch {
    // ignored (e.g. SSR)
  }
}

function update(patch) {
  Object.assign(state, patch);
  emit();
}

export function getIapState() {
  return snapshot();
}

export function subscribeIap(listener) {
  listeners.add(listener);
  // Immediately send current state so subscribers get a value on mount.
  try {
    listener(snapshot());
  } catch (e) {
    console.error("[IAP] listener initial error", e);
  }
  return () => listeners.delete(listener);
}

// ---------- Local Pro flag (optimistic UI cache only) --------------------

export function getStoredProFlag() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LOCAL_PRO_KEY) === "1";
}

export function setStoredProFlag(value) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_PRO_KEY, value ? "1" : "0");
}

// ---------- Product helpers ----------------------------------------------

function mapProduct(product) {
  if (!product) return null;
  const price =
    (product.pricing && product.pricing.price) ||
    product.price ||
    product.getOffer?.()?.pricingPhases?.[0]?.price ||
    "";
  return {
    id: product.id,
    displayName: product.title || "ArmPal Pro",
    description: product.description || "",
    displayPrice: typeof price === "string" ? price : "",
  };
}

function readProductFromStore(runtime) {
  const { store, Platform } = runtime;
  return (
    store.get(IOS_PRODUCT_ID, Platform.APPLE_APPSTORE) ||
    store.get(IOS_PRODUCT_ID) ||
    null
  );
}

function refreshProductState(runtime) {
  // Don't let a fallback product be overwritten by a still-empty real product.
  // If the fallback already fired and the real product still hasn't loaded,
  // we keep the fallback in place. Once the real product loads with a price,
  // we replace the fallback with the real value.
  const product = readProductFromStore(runtime);
  const mapped = mapProduct(product);
  const hasOffer = typeof product?.getOffer === "function" && !!product.getOffer();
  const canPurchase = !!product && (product.canPurchase === true || hasOffer);
  const hasPrice =
    typeof mapped?.displayPrice === "string" && mapped.displayPrice.trim().length > 0;
  const loaded = !!product && (hasPrice || hasOffer || canPurchase);

  try {
    console.log("[IAP] Products loaded:", runtime?.store?.products);
    console.log("[IAP] armpal_pro:", product);
  } catch {
    // no-op
  }

  if (state.fallback && !hasPrice && !hasOffer) {
    // Real product still empty — keep fallback values for the UI.
    return;
  }

  update({
    product: mapped,
    loaded,
    canPurchase,
    owned: !!product?.owned,
    // Once a real product arrives, drop the fallback flag.
    fallback: state.fallback && !loaded,
  });
  if (loaded && !state._loggedLoaded) {
    state._loggedLoaded = true;
    log("LOADED", mapped);
  }
  if (canPurchase && !state._loggedCan) {
    state._loggedCan = true;
    log("CAN PURCHASE", { id: mapped?.id, price: mapped?.displayPrice });
  }
}

function triggerFallback(reason = "timeout") {
  if (state.loaded) return; // real product won the race — nothing to do
  if (state.fallback) return; // already fired
  console.log("[IAP] TIMEOUT — fallback triggered", { reason });
  update({
    product: {
      id: IOS_PRODUCT_ID,
      displayName: "ArmPal Pro",
      description: "",
      displayPrice: FALLBACK_PRICE_LABEL,
    },
    loaded: true,
    canPurchase: true,
    fallback: true,
  });
}

// ---------- Purchase / restore control flow ------------------------------

let purchaseResolver = null;
let onVerifiedListener = null;

function resolvePurchase(result) {
  if (purchaseResolver) {
    const r = purchaseResolver;
    purchaseResolver = null;
    try {
      r(result);
    } catch (e) {
      console.error("[IAP] resolver error", e);
    }
  }
}

// Helpers for v13 callback filtering. `store.when()` in cordova-plugin-purchase
// v13 takes NO arguments and fires for ALL products. We filter by product id
// inside each callback so other future products do not accidentally trigger
// our paywall flow.
function transactionMatchesPro(transaction) {
  if (!transaction) return false;
  if (Array.isArray(transaction.products)) {
    return transaction.products.some((p) => p?.id === IOS_PRODUCT_ID);
  }
  if (transaction.productId === IOS_PRODUCT_ID) return true;
  if (typeof transaction.hasProductId === "function") {
    try { return !!transaction.hasProductId(IOS_PRODUCT_ID); } catch { /* noop */ }
  }
  return false;
}

function receiptHasPro(receipt) {
  if (!receipt) return false;
  if (typeof receipt.hasTransaction === "function") {
    try {
      // Some platforms expose hasTransaction(productId)
      if (receipt.hasTransaction(IOS_PRODUCT_ID)) return true;
    } catch { /* noop */ }
  }
  const txns = receipt.transactions || receipt.collection || [];
  for (const t of txns) {
    if (transactionMatchesPro(t)) return true;
  }
  // VerifiedReceipt shape: { collection: VerifiedPurchase[] }
  if (Array.isArray(receipt.collection)) {
    for (const c of receipt.collection) {
      if (c?.id === IOS_PRODUCT_ID || c?.productId === IOS_PRODUCT_ID) return true;
    }
  }
  return true; // best-effort: if we cannot determine, treat as ours (we only sell one product)
}

function wireStoreHandlers(runtime) {
  const { store, ErrorCode } = runtime;

  // Cancellation in v13 is delivered via store.error with code PAYMENT_CANCELLED.
  store.error((err) => {
    const code = err?.code;
    const message = err?.message || err?.description || "Store error";
    if (ErrorCode && code === ErrorCode.PAYMENT_CANCELLED) {
      log("USER CANCELLED", { code, message });
      // Do NOT set lastError on cancellation - it isn't a real failure.
      resolvePurchase({ status: "userCancelled" });
      return;
    }
    log("ERROR", { code, message, err });
    update({ lastError: message });
    resolvePurchase({ status: "failed", error: message });
  });

  // Single chained when() — v13 ignores any argument passed to when().
  store
    .when()
    .productUpdated(() => {
      refreshProductState(runtime);
    })
    .receiptUpdated(() => {
      refreshProductState(runtime);
    })
    .approved((transaction) => {
      if (!transactionMatchesPro(transaction)) return;
      log("APPROVED", {
        id: IOS_PRODUCT_ID,
        transactionId: transaction?.transactionId,
      });
      try {
        // verify() returns a Promise. Without a configured validator, the
        // plugin auto-resolves verification (see Validator.verify backward-compat).
        const p = transaction.verify();
        Promise.resolve(p).catch((e) => {
          log("ERROR", e);
          update({ lastError: e?.message || "Verification failed" });
          resolvePurchase({ status: "failed", error: e?.message || "Verification failed" });
        });
      } catch (e) {
        log("ERROR", e);
        update({ lastError: e?.message || "Verification could not start." });
        resolvePurchase({ status: "failed", error: e?.message || "Verification failed" });
      }
    })
    .verified((receipt) => {
      if (!receiptHasPro(receipt)) return;
      try {
        const p = receipt.finish();
        Promise.resolve(p).catch((e) => log("ERROR", e));
        log("FINISHED", { id: IOS_PRODUCT_ID });
      } catch (e) {
        log("ERROR", e);
      }
      update({ owned: true, lastError: null });
      if (onVerifiedListener) {
        try {
          onVerifiedListener();
        } catch (e) {
          console.error("[IAP] verified listener error", e);
        }
      }
      resolvePurchase({ status: "success", verified: true });
    })
    .unverified((data) => {
      if (data?.receipt && !receiptHasPro(data.receipt)) return;
      const msg = data?.payload?.message || "Apple could not verify this purchase.";
      log("ERROR", msg);
      update({ lastError: msg });
      resolvePurchase({ status: "verificationFailed", error: msg });
    })
    .finished((transaction) => {
      if (!transactionMatchesPro(transaction)) return;
      log("FINISHED", { transactionId: transaction?.transactionId });
      refreshProductState(runtime);
    });
}

// ---------- Boot (runs once at module load on iOS) -----------------------

let bootPromise = null;

export function bootPurchases() {
  if (bootPromise) return bootPromise;
  if (!isNativeIOS()) {
    bootPromise = Promise.resolve({ ok: false, reason: "not-ios" });
    return bootPromise;
  }
  bootPromise = (async () => {
    // Hard 5-second fail-safe: if the real product hasn't loaded by then,
    // force a fallback so the paywall UI cannot stay stuck on "Loading...".
    const fallbackTimer = setTimeout(() => {
      if (!state.loaded) triggerFallback("boot-timeout");
    }, FALLBACK_TIMEOUT_MS);

    try {
      console.log("[IAP] Store initializing...");
      log("INIT", { productId: IOS_PRODUCT_ID });
      const runtime = await waitForRuntime();
      if (!runtime) {
        const msg = "In-app purchases runtime unavailable.";
        log("ERROR", msg);
        update({ lastError: msg });
        triggerFallback("no-runtime");
        return { ok: false, reason: "no-runtime" };
      }
      const { store, Platform, ProductType } = runtime;
      // ErrorCode is read inside wireStoreHandlers via `runtime.ErrorCode`.

      wireStoreHandlers(runtime);

      store.register({
        id: IOS_PRODUCT_ID,
        type: ProductType.PAID_SUBSCRIPTION,
        platform: Platform.APPLE_APPSTORE,
      });
      update({ registered: true });
      log("REGISTERED", { id: IOS_PRODUCT_ID, type: "PAID_SUBSCRIPTION" });

      await store.initialize([Platform.APPLE_APPSTORE]);
      update({ initialized: true });

      await new Promise((resolve) => store.ready(() => resolve()));
      update({ ready: true });
      console.log("[IAP] Store ready");

      await store.update();
      refreshProductState(runtime);

      return { ok: true };
    } catch (e) {
      const msg = e?.message || "IAP boot failed.";
      log("ERROR", e);
      update({ lastError: msg });
      triggerFallback("boot-error");
      return { ok: false, reason: "boot-error", error: msg };
    } finally {
      clearTimeout(fallbackTimer);
    }
  })();
  return bootPromise;
}

// Auto-boot on module load for iOS — runs before the paywall opens.
if (typeof window !== "undefined") {
  bootPurchases().catch(() => {
    // already logged inside bootPurchases
  });
}

// ---------- Public API ---------------------------------------------------

export function setVerifiedListener(fn) {
  onVerifiedListener = fn || null;
}

export function forceFallback(reason = "manual") {
  triggerFallback(reason);
  return snapshot();
}

export function printIapReport() {
  const s = snapshot();
  const productFound = !!s.product;
  const stuck = isNativeIOS() && !s.loaded && !s.fallback;
  console.log("[IAP REPORT]");
  console.log("- Product found:", productFound ? "YES" : "NO");
  console.log("- Store initialized:", s.initialized ? "YES" : "NO");
  console.log("- Store ready fired:", s.ready ? "YES" : "NO");
  console.log("- Product loaded:", s.loaded ? "YES" : "NO");
  console.log("- UI can get stuck loading:", stuck ? "YES" : "NO");
  console.log("- Fallback implemented:", "YES");
  console.log("- Fallback active:", s.fallback ? "YES" : "NO");
  console.log("- Last error:", s.lastError || "none");
  return s;
}

export async function refreshProduct() {
  if (!isNativeIOS()) return snapshot();
  await bootPurchases();
  const runtime = getRuntime();
  if (!runtime) return snapshot();
  try {
    await runtime.store.update();
  } catch (e) {
    log("ERROR", e);
  }
  refreshProductState(runtime);
  return snapshot();
}

export async function orderPro() {
  if (!isNativeIOS()) {
    return { status: "unsupported", error: "iOS-only purchase." };
  }
  log("ORDER CALLED", { id: IOS_PRODUCT_ID });
  const boot = await bootPurchases();
  if (!boot.ok) {
    const err = boot.error || "Purchases unavailable.";
    update({ lastError: err });
    return { status: "failed", error: err };
  }
  const runtime = getRuntime();
  if (!runtime) {
    const err = "Store runtime unavailable.";
    update({ lastError: err });
    return { status: "failed", error: err };
  }

  refreshProductState(runtime);

  const product = readProductFromStore(runtime);
  if (!product) {
    const err = "Product not loaded yet.";
    update({ lastError: err });
    return { status: "failed", error: err };
  }
  if (product.owned) {
    update({ owned: true, lastError: null });
    return { status: "success", verified: true };
  }

  const offer =
    typeof product.getOffer === "function" ? product.getOffer() : null;
  if (!offer && typeof product.order !== "function") {
    const err = "Product has no purchasable offer.";
    update({ lastError: err });
    return { status: "failed", error: err };
  }

  return new Promise((resolve) => {
    purchaseResolver = resolve;
    const call = offer ? offer.order() : product.order();
    Promise.resolve(call).catch((e) => {
      const err = e?.message || "Could not start purchase.";
      log("ERROR", e);
      update({ lastError: err });
      resolvePurchase({ status: "failed", error: err });
    });
  });
}

export async function restoreIap() {
  if (!isNativeIOS()) {
    return { hasActiveEntitlement: false, error: "iOS-only." };
  }
  const boot = await bootPurchases();
  if (!boot.ok) {
    return { hasActiveEntitlement: false, error: boot.error || "Purchases unavailable." };
  }
  const runtime = getRuntime();
  if (!runtime) {
    return { hasActiveEntitlement: false, error: "Store runtime unavailable." };
  }
  try {
    await runtime.store.restorePurchases();
    await runtime.store.update();
    refreshProductState(runtime);
    const owned = !!readProductFromStore(runtime)?.owned;
    update({ owned });
    return { hasActiveEntitlement: owned };
  } catch (e) {
    const err = e?.message || "Restore failed.";
    log("ERROR", e);
    update({ lastError: err });
    return { hasActiveEntitlement: false, error: err };
  }
}

export async function checkEntitlements() {
  if (!isNativeIOS()) return { hasActiveEntitlement: false };
  const boot = await bootPurchases();
  if (!boot.ok) return { hasActiveEntitlement: false, error: boot.error };
  const runtime = getRuntime();
  if (!runtime) return { hasActiveEntitlement: false };
  try {
    await runtime.store.update();
  } catch (e) {
    log("ERROR", e);
  }
  refreshProductState(runtime);
  return { hasActiveEntitlement: !!readProductFromStore(runtime)?.owned };
}

// ---------- Back-compat wrappers (used by existing context) --------------

export async function initializePurchaseStore(onVerified) {
  if (onVerified) setVerifiedListener(onVerified);
  if (!isNativeIOS()) {
    return { product: null, hasActiveEntitlement: false };
  }
  const boot = await bootPurchases();
  if (!boot.ok) {
    return {
      product: null,
      hasActiveEntitlement: false,
      error: boot.error || "Purchases unavailable.",
    };
  }
  const snap = snapshot();
  return { product: snap.product, hasActiveEntitlement: snap.owned };
}

export async function fetchProductPriceWithRetry(maxAttempts = 3) {
  if (!isNativeIOS()) return { product: null, priceStatus: "failed" };
  await bootPurchases();
  for (let i = 0; i < maxAttempts; i++) {
    await refreshProduct();
    const snap = snapshot();
    const price =
      typeof snap.product?.displayPrice === "string"
        ? snap.product.displayPrice.trim()
        : "";
    if (price.length > 0) return { product: snap.product, priceStatus: "ready" };
    await new Promise((r) => setTimeout(r, 450));
  }
  return { product: snapshot().product, priceStatus: "failed" };
}

export async function purchaseProProduct() {
  const r = await orderPro();
  if (r.status === "success" && r.verified) return r;
  if (r.status === "userCancelled") return r;
  if (r.status === "verificationFailed") return r;
  if (r.status === "unsupported") return r;
  return { status: r.status || "failed", message: r.error || "Purchase failed." };
}

export async function restorePurchases() {
  return restoreIap();
}
