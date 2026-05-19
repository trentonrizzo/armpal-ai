import { Capacitor } from "@capacitor/core";

function isRecoveryAppUrl(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.toLowerCase();
  return (
    u.includes("reset-password") ||
    u.includes("type=recovery") ||
    u.includes("type%3drecovery") ||
    u.includes("token_hash=") ||
    u.includes("code=") ||
    u.includes("access_token") ||
    u.includes("refresh_token")
  );
}

/**
 * When the native Capacitor App plugin is present, route auth recovery opens to /reset-password
 * so onboarding/profile logic never hijacks the flow.
 */
export function registerPasswordRecoveryDeepLinkListener() {
  if (typeof window === "undefined") return () => {};

  const AppPlugin = Capacitor?.Plugins?.App;
  if (!AppPlugin || typeof AppPlugin.addListener !== "function") {
    return () => {};
  }

  let handle = null;

  void (async () => {
    try {
      handle = await AppPlugin.addListener("appUrlOpen", ({ url }) => {
        if (!isRecoveryAppUrl(url)) return;
        console.log("[PasswordRecovery] appUrlOpen (recovery-related)", url);
        try {
          const parsed = new URL(url);
          const origin = window.location.origin.replace(/\/+$/, "");
          const nextPath = "/reset-password";
          const next = `${origin}${nextPath}${parsed.search || ""}${parsed.hash || ""}`;
          window.location.assign(next);
        } catch (e) {
          console.warn("[PasswordRecovery] failed to normalize appUrlOpen URL", e?.message || e);
        }
      });
    } catch (e) {
      console.warn("[PasswordRecovery] App.addListener(appUrlOpen) unavailable", e?.message || e);
    }
  })();

  return () => {
    try {
      handle?.remove?.();
    } catch {
      /* ignore */
    }
  };
}
