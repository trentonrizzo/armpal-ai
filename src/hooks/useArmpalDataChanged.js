import { useEffect, useRef } from "react";
import { ARMPAL_DATA_CHANGED } from "../lib/armpalDataChanged";

/**
 * Call `onChange` when the voice agent (or anyone) mutates a matching domain.
 */
export function useArmpalDataChanged(domains, onChange) {
  const cb = useRef(onChange);
  cb.current = onChange;
  const wantedKey = Array.isArray(domains) ? domains.join(",") : String(domains || "");

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const wanted = wantedKey.split(",").filter(Boolean);
    const handler = (event) => {
      const domain = event.detail?.domain;
      if (!domain || domain === "*" || wanted.includes(domain)) {
        cb.current?.(event.detail);
      }
    };
    window.addEventListener(ARMPAL_DATA_CHANGED, handler);
    return () => window.removeEventListener(ARMPAL_DATA_CHANGED, handler);
  }, [wantedKey]);
}
