/** YYYY-MM-DD for an instant in an IANA timezone (en-CA). */
export function ymdInTimeZone(date, timeZone = "UTC") {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function hmInTimeZone(date, timeZone = "UTC") {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const h = parts.find((p) => p.type === "hour")?.value ?? "00";
    const m = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  } catch {
    const h = date.getUTCHours();
    const m = date.getUTCMinutes();
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
}

export function isValidTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function addDaysYmd(ymd, days) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(days || 0)));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function isYmd(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Convert a calendar date + clock time in `timeZone` to a UTC ISO string.
 */
export function zonedLocalToUtcIso(ymd, hm = "09:00", timeZone = "UTC") {
  if (!isYmd(ymd)) return null;
  const [year, month, day] = ymd.split("-").map(Number);
  const [hour, minute] = String(hm || "09:00").split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const instant = new Date(utc);
    const gotYmd = ymdInTimeZone(instant, timeZone);
    const gotHm = hmInTimeZone(instant, timeZone);
    const [gy, gm, gd] = gotYmd.split("-").map(Number);
    const [gh, gmin] = gotHm.split(":").map(Number);
    const gotMs = Date.UTC(gy, gm - 1, gd, gh, gmin, 0);
    const wantMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    utc += wantMs - gotMs;
  }
  return new Date(utc).toISOString();
}

export function parseStoredTimestamp(raw) {
  if (raw == null) return null;
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  const hasOffset = /[Z]$/i.test(s) || /[+-]\d{2}(:\d{2})?$/.test(s);
  const d = new Date(hasOffset ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function storedInstantToYmd(raw, timeZone) {
  const d = parseStoredTimestamp(raw);
  if (!d) return null;
  return ymdInTimeZone(d, timeZone || "UTC");
}
