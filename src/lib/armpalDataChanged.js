export const ARMPAL_DATA_CHANGED = "armpal:data-changed";

export function dispatchArmpalDataChanged(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ARMPAL_DATA_CHANGED, {
      detail: {
        domain: detail.domain || "*",
        action: detail.action || "update",
        id: detail.id || null,
      },
    })
  );
}
