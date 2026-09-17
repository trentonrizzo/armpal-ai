const STORAGE_KEY = "armpal_revenue_events";
const MAX_EVENTS = 50;

export const REVENUE_EVENTS = {
  PAYWALL_VIEWED: "paywall_viewed",
  UPGRADE_INITIATED: "upgrade_initiated",
  PURCHASE_COMPLETED: "purchase_completed",
  PURCHASE_RESTORED: "purchase_restored",
  PRO_ACTIVE: "pro_active",
};

function readStore() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(events) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    /* quota / private mode */
  }
}

export function trackRevenueEvent(name, props = {}) {
  const event = {
    name: String(name || ""),
    props: props && typeof props === "object" ? { ...props } : {},
    ts: new Date().toISOString(),
  };
  if (!event.name) return event;
  try {
    console.info("[ArmPal.Revenue]", event.name, event.props);
  } catch {
    /* ignore */
  }
  const next = [...readStore(), event];
  writeStore(next);
  return event;
}

export function getRevenueEvents() {
  return readStore();
}

export function clearRevenueEvents() {
  writeStore([]);
}
