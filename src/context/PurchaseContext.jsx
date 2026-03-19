import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  checkEntitlements,
  getStoredProFlag,
  initializePurchaseStore,
  purchaseProProduct,
  restorePurchases,
  setStoredProFlag,
} from "../services/purchaseManager";

const PurchaseContext = createContext(null);

async function persistProToProfile() {
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;
  if (!uid) return;
  const { error } = await supabase
    .from("profiles")
    .update({ is_pro: true })
    .eq("id", uid);
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
  const [product, setProduct] = useState(null);
  const [isPro, setIsPro] = useState(getStoredProFlag());
  const [initializing, setInitializing] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  async function unlockPro() {
    setIsPro(true);
    setStoredProFlag(true);
    await persistProToProfile();
  }

  async function initialize() {
    setInitializing(true);
    try {
      const initResult = await initializePurchaseStore(unlockPro);
      setProduct(initResult.product || null);
      if (initResult.hasActiveEntitlement) {
        await unlockPro();
      }

      // Extra safety pass at launch against current entitlements.
      const entitlements = await checkEntitlements();
      if (entitlements?.hasActiveEntitlement) {
        await unlockPro();
      }
      // Keep previously persisted Pro state in sync across sessions.
      const profileIsPro = await getProfileProFlag();
      if (profileIsPro) {
        setIsPro(true);
        setStoredProFlag(true);
      }
    } catch {
      // keep UI stable; purchase buttons will show friendly failure on action
    } finally {
      setInitializing(false);
    }
  }

  useEffect(() => {
    initialize();
  }, []);

  async function purchase() {
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
  }

  async function restore() {
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
      return { ok: false, error: "No active ArmPal Pro subscription found." };
    } catch {
      return { ok: false, error: "Restore failed. Please try again." };
    } finally {
      setRestoreLoading(false);
    }
  }

  const value = useMemo(
    () => ({
      product,
      isPro,
      initializing,
      purchaseLoading,
      restoreLoading,
      purchase,
      restore,
      refreshEntitlements: initialize,
      setIsPro, // optional for immediate local UI adjustments elsewhere
    }),
    [product, isPro, initializing, purchaseLoading, restoreLoading]
  );

  return <PurchaseContext.Provider value={value}>{children}</PurchaseContext.Provider>;
}

export function usePurchase() {
  const ctx = useContext(PurchaseContext);
  if (!ctx) throw new Error("usePurchase must be used within PurchaseProvider");
  return ctx;
}
