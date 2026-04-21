import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "../supabaseClient";
import {
  bootPurchases,
  checkEntitlements,
  getIapState,
  orderPro,
  refreshProduct,
  restoreIap,
  setStoredProFlag,
  setVerifiedListener,
  subscribeIap,
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
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_pro")
    .eq("id", uid)
    .maybeSingle();
  if (error) return false;
  return !!profile?.is_pro;
}

export function PurchaseProvider({ children }) {
  const [iap, setIap] = useState(() => getIapState());
  const [subscriptionStatus, setSubscriptionStatus] = useState("loading");
  const [initializing, setInitializing] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const sessionUserIdRef = useRef(undefined);

  const isPro = subscriptionStatus === "pro";
  const product = iap.product;
  const priceStatus = useMemo(() => {
    if (!isNativeIOS()) return "failed";
    const p = iap.product?.displayPrice;
    if (typeof p === "string" && p.trim().length > 0) return "ready";
    if (iap.lastError && !iap.loaded) return "failed";
    return "loading";
  }, [iap.product, iap.loaded, iap.lastError]);

  const unlockPro = useCallback(async () => {
    setSubscriptionStatus("pro");
    setStoredProFlag(true);
    await persistProToProfile();
  }, []);

  const applyFreeState = useCallback(() => {
    setSubscriptionStatus("free");
    setStoredProFlag(false);
  }, []);

  useEffect(() => {
    setVerifiedListener(() => {
      unlockPro().catch((e) => console.error(e));
    });
    return () => setVerifiedListener(null);
  }, [unlockPro]);

  useEffect(() => subscribeIap(setIap), []);

  const resolveSubscriptionState = useCallback(async () => {
    setInitializing(true);
    setSubscriptionStatus("loading");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user?.id) {
        setStoredProFlag(false);
        applyFreeState();
        return;
      }

      if (isNativeIOS()) {
        setStoredProFlag(false);
        await bootPurchases();
        await refreshProduct();
        const ent = await checkEntitlements();
        if (ent?.hasActiveEntitlement) {
          await unlockPro();
        } else {
          await clearProFromProfile();
          applyFreeState();
        }
      } else {
        const profileIsPro = await getProfileProFlag();
        if (profileIsPro) {
          setStoredProFlag(true);
          setSubscriptionStatus("pro");
        } else {
          setStoredProFlag(false);
          applyFreeState();
        }
      }
    } catch (e) {
      console.error("[PurchaseContext] resolveSubscriptionState", e);
      setSubscriptionStatus("error");
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
      const result = await orderPro();
      if (result.status === "success" && result.verified) {
        await unlockPro();
        return { ok: true, status: result.status };
      }
      if (result.status === "userCancelled") {
        return { ok: false, status: result.status };
      }
      if (result.status === "pending") {
        return { ok: false, status: result.status };
      }
      if (result.status === "verificationFailed") {
        return {
          ok: false,
          status: result.status,
          error: result.error || "Apple could not verify this purchase.",
        };
      }
      if (result.status === "unsupported") {
        return { ok: false, status: result.status, error: "iOS-only purchase." };
      }
      return {
        ok: false,
        status: result.status || "failed",
        error: result.error || "Purchase failed.",
      };
    } catch (e) {
      return { ok: false, status: "failed", error: e?.message || "Purchase failed." };
    } finally {
      setPurchaseLoading(false);
    }
  }, [unlockPro]);

  const restore = useCallback(async () => {
    setRestoreLoading(true);
    try {
      const result = await restoreIap();
      if (result?.hasActiveEntitlement) {
        await unlockPro();
        return { ok: true };
      }
      if (result?.error) {
        return { ok: false, error: result.error };
      }
      return { ok: false, error: "No active subscription found." };
    } catch (e) {
      return { ok: false, error: e?.message || "Restore failed." };
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
      // Raw IAP flags the paywall needs for precise button gating.
      productLoaded: iap.loaded,
      canPurchase: iap.canPurchase,
      iapError: iap.lastError,
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
      iap.loaded,
      iap.canPurchase,
      iap.lastError,
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
