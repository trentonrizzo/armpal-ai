import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "../supabaseClient";
import {
  checkEntitlements,
  fetchProductPriceWithRetry,
  initializePurchaseStore,
  purchaseProProduct,
  restorePurchases,
  setStoredProFlag,
} from "../services/purchaseManager";

const PurchaseContext = createContext(null);

function isNativeIOS() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

async function persistProToProfile() {
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;
  if (!uid) return;
  const { error } = await supabase.from("profiles").update({ is_pro: true }).eq("id", uid);
  if (error) console.error(error);
}

async function clearProFromProfile() {
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;
  if (!uid) return;
  const { error } = await supabase.from("profiles").update({ is_pro: false }).eq("id", uid);
  if (error) console.error(error);
}

async function getProfileProFlag() {
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;
  if (!uid) return false;
  const { data: profile, error } = await supabase.from("profiles").select("is_pro").eq("id", uid).maybeSingle();
  if (error) return false;
  return !!profile?.is_pro;
}

/**
 * subscriptionStatus: verified Pro only on iOS via Store; on web/Android, server profile.is_pro.
 * priceStatus: iOS Store price fetch; web has no live price.
 */
export function PurchaseProvider({ children }) {
  const [product, setProduct] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState("loading");
  const [priceStatus, setPriceStatus] = useState(() => (isNativeIOS() ? "loading" : "failed"));
  const [initializing, setInitializing] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const sessionUserIdRef = useRef(undefined);

  const isPro = subscriptionStatus === "pro";

  const unlockPro = useCallback(async () => {
    setSubscriptionStatus("pro");
    setStoredProFlag(true);
    await persistProToProfile();
  }, []);

  const applyFreeState = useCallback(() => {
    setSubscriptionStatus("free");
    setStoredProFlag(false);
  }, []);

  const resolveSubscriptionState = useCallback(async () => {
    setInitializing(true);
    setSubscriptionStatus("loading");
    setPriceStatus(isNativeIOS() ? "loading" : "failed");
    setProduct(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user?.id) {
        setStoredProFlag(false);
        applyFreeState();
        return;
      }

      if (isNativeIOS()) {
        // Conservative: clear stale local Pro before Store verification.
        setStoredProFlag(false);

        const initResult = await initializePurchaseStore(unlockPro);
        setProduct(initResult.product || null);

        const ent = await checkEntitlements();
        const verified = !!(initResult.hasActiveEntitlement || ent?.hasActiveEntitlement);

        if (verified) {
          await unlockPro();
        } else {
          await clearProFromProfile();
          applyFreeState();
        }

        const priceOutcome = await fetchProductPriceWithRetry(3);
        if (priceOutcome.priceStatus === "ready" && priceOutcome.product?.displayPrice) {
          setProduct(priceOutcome.product);
          setPriceStatus("ready");
        } else if (initResult.product?.displayPrice) {
          setPriceStatus("ready");
        } else {
          setPriceStatus("failed");
        }
      } else {
        // No App Store on web; backend profile is the entitlement source here.
        const profileIsPro = await getProfileProFlag();
        if (profileIsPro) {
          setStoredProFlag(true);
          setSubscriptionStatus("pro");
        } else {
          setStoredProFlag(false);
          applyFreeState();
        }
        setPriceStatus("failed");
        setProduct(null);
      }
    } catch (e) {
      console.error("[PurchaseContext] resolveSubscriptionState", e);
      setSubscriptionStatus("error");
      setPriceStatus("failed");
      setStoredProFlag(false);
    } finally {
      setInitializing(false);
    }
  }, [applyFreeState, unlockPro]);

  useEffect(() => {
    let cancelled = false;

    async function onSession(session) {
      const uid = session?.user?.id ?? null;
      if (sessionUserIdRef.current === uid && uid !== null) return;
      sessionUserIdRef.current = uid;
      if (cancelled) return;
      await resolveSubscriptionState();
    }

    supabase.auth.getSession().then(({ data: { session } }) => onSession(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      onSession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [resolveSubscriptionState]);

  const purchase = useCallback(async () => {
    setPurchaseLoading(true);
    try {
      const result = await purchaseProProduct();
      const status = result?.status;

      if (status === "success" && result?.verified) {
        await unlockPro();
        return { ok: true, status };
      }
      if (status === "userCancelled") {
        return { ok: false, status };
      }
      if (status === "pending") {
        return { ok: false, status };
      }
      if (status === "verificationFailed") {
        return { ok: false, status, error: "Verification failed" };
      }
      if (status === "unsupported") {
        return { ok: false, status, error: "In-app purchases require iOS app build" };
      }
      return { ok: false, status: status || "failed", error: result?.message || "Purchase failed" };
    } catch {
      return { ok: false, status: "failed", error: "Purchase failed. Please try again." };
    } finally {
      setPurchaseLoading(false);
    }
  }, [unlockPro]);

  const restore = useCallback(async () => {
    setRestoreLoading(true);
    try {
      const result = await restorePurchases();
      if (result?.hasActiveEntitlement) {
        await unlockPro();
        return { ok: true };
      }
      if (result?.error) {
        return { ok: false, error: result.error };
      }
      return { ok: false, error: "No active subscription found." };
    } catch {
      return { ok: false, error: "Restore failed. Please try again." };
    } finally {
      setRestoreLoading(false);
    }
  }, [unlockPro]);

  const refreshEntitlements = useCallback(async () => {
    await resolveSubscriptionState();
  }, [resolveSubscriptionState]);

  const value = useMemo(
    () => ({
      product,
      isPro,
      subscriptionStatus,
      priceStatus,
      initializing,
      purchaseLoading,
      restoreLoading,
      purchase,
      restore,
      refreshEntitlements,
    }),
    [
      product,
      isPro,
      subscriptionStatus,
      priceStatus,
      initializing,
      purchaseLoading,
      restoreLoading,
      purchase,
      restore,
      refreshEntitlements,
    ]
  );

  return <PurchaseContext.Provider value={value}>{children}</PurchaseContext.Provider>;
}

export function usePurchase() {
  const ctx = useContext(PurchaseContext);
  if (!ctx) throw new Error("usePurchase must be used within PurchaseProvider");
  return ctx;
}
