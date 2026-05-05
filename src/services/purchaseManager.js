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

function logReal(tag, ...rest) {
  try {
    console.log(`[IAP REAL] ${tag}`, ...rest);
  } catch {
    // no-op
  }
}

async function readBundleId() {
  try {
    const App = Capacitor?.Plugins?.App;
    if (App && typeof App.getInfo === "function") {
      const info = await App.getInfo();
      return info?.id || null;
    }
  } catch {
    // App plugin not available — that's fine.
  }
  return null;
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

// Resolve only once BOTH:
// (a) the Capacitor native layer / Cordova `deviceready` is ready, AND
// (b) `window.CdvPurchase.store` is attached by cordova-plugin-purchase.
// Never call store.* methods before both are true — they'll silently no-op
// or throw if the bridge isn't up yet.
function waitForRuntime(timeoutMs = 15000) {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    const started = Date.now();
    const finish = (v) => {
      if (done) return;
      done = true;
      resolve(v);
    };

    let nativeReady = !Capacitor?.isNativePlatform?.(); // web is "ready" by definition
    const markNativeReady = () => {
      nativeReady = true;
      const rt = getRuntime();
      if (rt) finish(rt);
    };

    if (Capacitor?.isNativePlatform?.()) {
      // Cordova-style readiness signal that cordova-plugin-purchase relies on.
      document.addEventListener("deviceready", markNativeReady, { once: true });
      // Capacitor 8 fires its bridge synchronously; if it's already up, the
      // poller below will pick up `window.CdvPurchase` as soon as it attaches.
      if (typeof Capacitor?.Plugins === "object") nativeReady = true;
    }

    const tick = () => {
      const rt = getRuntime();
      if (nativeReady && rt) return finish(rt);
      if (Date.now() - started >= timeoutMs) return finish(getRuntime() || null);
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

      // Wait for both deviceready / Capacitor native bridge AND for the
      // cordova-plugin-purchase JS shim to attach `window.CdvPurchase`.
      const runtime = await waitForRuntime();

      // [IAP REAL] CdvPurchase presence — proves native plugin is wired in.
      logReal("CdvPurchase exists", !!runtime, {
        platform: Capacitor?.getPlatform?.(),
        isNative: Capacitor?.isNativePlatform?.(),
      });

      const bundleId = await readBundleId();
      logReal("bundle id", bundleId || "(unavailable — @capacitor/app plugin not present)");

      if (!runtime) {
        const msg = "In-app purchases runtime unavailable.";
        logReal("errors", { stage: "no-runtime", message: msg });
        log("ERROR", msg);
        update({ lastError: msg });
        triggerFallback("no-runtime");
        printRealDiagnostic({ reason: "no-runtime", bundleId, runtime: null });
        return { ok: false, reason: "no-runtime" };
      }

      const { store, Platform, ProductType } = runtime;
      // ErrorCode is read inside wireStoreHandlers via `runtime.ErrorCode`.

      wireStoreHandlers(runtime);

      // v13 canonical array-form register call.
      try {
        store.register([
          {
            id: IOS_PRODUCT_ID,
            type: ProductType.PAID_SUBSCRIPTION,
            platform: Platform.APPLE_APPSTORE,
          },
        ]);
        update({ registered: true });
        log("REGISTERED", { id: IOS_PRODUCT_ID, type: "PAID_SUBSCRIPTION" });
        logReal("registered armpal_pro", {
          id: IOS_PRODUCT_ID,
          type: "PAID_SUBSCRIPTION",
          platform: "APPLE_APPSTORE",
        });
      } catch (e) {
        const msg = e?.message || "Register failed";
        logReal("errors", { stage: "register", message: msg, err: e });
        update({ lastError: msg });
        triggerFallback("register-error");
        printRealDiagnostic({ reason: "register-error", bundleId, runtime, error: msg });
        return { ok: false, reason: "register-error", error: msg };
      }

      try {
        await store.initialize([Platform.APPLE_APPSTORE]);
        update({ initialized: true });
        logReal("initialized APPLE_APPSTORE", { ok: true });
      } catch (e) {
        const msg = e?.message || "store.initialize failed";
        logReal("errors", { stage: "initialize", message: msg, err: e });
        update({ lastError: msg });
        triggerFallback("initialize-error");
        printRealDiagnostic({ reason: "initialize-failed", bundleId, runtime, error: msg });
        return { ok: false, reason: "initialize-failed", error: msg };
      }

      await new Promise((resolve) => store.ready(() => resolve()));
      update({ ready: true });
      console.log("[IAP] Store ready");

      try {
        await store.update();
      } catch (e) {
        const msg = e?.message || "store.update failed";
        logReal("errors", { stage: "update", message: msg, err: e });
        update({ lastError: msg });
      }
      refreshProductState(runtime);

      // ---- [IAP REAL] product / offers ----------------------------------
      const products = runtime.store?.products || [];
      logReal("store products", products);
      const realProduct = readProductFromStore(runtime);
      logReal("armpal_pro product", realProduct);

      let offers = [];
      try {
        if (Array.isArray(realProduct?.offers)) offers = realProduct.offers;
        else if (typeof realProduct?.getOffers === "function") offers = realProduct.getOffers() || [];
        else if (typeof realProduct?.getOffer === "function") {
          const o = realProduct.getOffer();
          offers = o ? [o] : [];
        }
      } catch (e) {
        logReal("errors", { stage: "read-offers", message: e?.message, err: e });
      }
      logReal("offers", offers);

      // Final categorical diagnostic if product still didn't load.
      if (!state.loaded) {
        printRealDiagnostic({
          reason: "no-product",
          bundleId,
          runtime,
          products,
          realProduct,
          offers,
        });
      }

      return { ok: true };
    } catch (e) {
      const msg = e?.message || "IAP boot failed.";
      logReal("errors", { stage: "boot", message: msg, err: e });
      log("ERROR", e);
      update({ lastError: msg });
      triggerFallback("boot-error");
      printRealDiagnostic({ reason: "boot-error", error: msg });
      return { ok: false, reason: "boot-error", error: msg };
    } finally {
      clearTimeout(fallbackTimer);
    }
  })();
  return bootPromise;
}

// Categorical post-mortem when the real Apple connection didn't deliver
// armpal_pro. Tells the developer EXACTLY which gate failed.
function printRealDiagnostic({
  reason,
  bundleId,
  runtime,
  products,
  realProduct,
  offers,
  error,
}) {
  const expectedBundle = "com.armpal.app";
  const expectedProductId = IOS_PRODUCT_ID;

  const causes = {
    missingNativePlugin:
      reason === "no-runtime" || !runtime || typeof runtime?.store?.register !== "function",
    wrongBundleId: !!bundleId && bundleId !== expectedBundle,
    productIdMismatch:
      Array.isArray(products) &&
      products.length > 0 &&
      !products.some((p) => p?.id === expectedProductId),
    appleReturnedEmptyProducts:
      reason === "no-product" && Array.isArray(products) && products.length === 0,
    noOffersReturned:
      !!realProduct && Array.isArray(offers) && offers.length === 0,
    storeInitializeFailed: reason === "initialize-failed" || reason === "register-error",
  };

  console.log("[IAP REAL] DIAGNOSTIC ----------------------------------");
  console.log("[IAP REAL] reason:", reason);
  if (error) console.log("[IAP REAL] error:", error);
  console.log("[IAP REAL] bundle id (read):", bundleId || "unavailable");
  console.log("[IAP REAL] bundle id (expected):", expectedBundle);
  console.log("[IAP REAL] product id (expected):", expectedProductId);
  console.log("[IAP REAL] cause: missing native plugin:", causes.missingNativePlugin ? "YES" : "no");
  console.log("[IAP REAL] cause: wrong bundle id:", causes.wrongBundleId ? "YES" : "no");
  console.log("[IAP REAL] cause: product id mismatch:", causes.productIdMismatch ? "YES" : "no");
  console.log(
    "[IAP REAL] cause: Apple returned empty products:",
    causes.appleReturnedEmptyProducts ? "YES" : "no"
  );
  console.log("[IAP REAL] cause: no offers returned:", causes.noOffersReturned ? "YES" : "no");
  console.log(
    "[IAP REAL] cause: store initialize failed:",
    causes.storeInitializeFailed ? "YES" : "no"
  );

  // Single human-readable verdict.
  let verdict = "Unknown — see causes above.";
  if (causes.missingNativePlugin) {
    verdict =
      "MISSING NATIVE PLUGIN — `window.CdvPurchase` is not attached. " +
      "Run `npx cap sync ios` so cordova-plugin-purchase is copied into " +
      "`ios/App/capacitor-cordova-ios-plugins/` and rebuild from Xcode.";
  } else if (causes.wrongBundleId) {
    verdict =
      `WRONG BUNDLE ID — device reports "${bundleId}" but App Store Connect ` +
      `expects "${expectedBundle}". Subscription products are scoped to a bundle id.`;
  } else if (causes.storeInitializeFailed) {
    verdict =
      "STORE INITIALIZE FAILED — store.register / store.initialize threw. " +
      "Check the printed error above and verify Capacitor sync.";
  } else if (causes.productIdMismatch) {
    verdict =
      "PRODUCT ID MISMATCH — Apple returned products but none have id " +
      `"${expectedProductId}". Check the Subscriptions section in App Store Connect.`;
  } else if (causes.appleReturnedEmptyProducts) {
    verdict =
      "APPLE RETURNED EMPTY PRODUCTS — most common causes (in order of " +
      "likelihood): (1) Paid Apps Agreement not active in App Store Connect → " +
      "Agreements, Tax, and Banking, (2) the subscription is not in 'Ready to " +
      "Submit' state and assigned to a Subscription Group with a localization + " +
      "price, (3) the device is signed into a regular Apple ID instead of a " +
      "Sandbox Tester, (4) running in a build that wasn't installed via Xcode " +
      "or TestFlight.";
  } else if (causes.noOffersReturned) {
    verdict =
      "NO OFFERS RETURNED — the product was found but has no subscription " +
      "offer. In App Store Connect, ensure the subscription has an active " +
      "Subscription Price for the device's storefront.";
  }
  console.log("[IAP REAL] VERDICT:", verdict);
  console.log("[IAP REAL] -----------------------------------------------");
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
