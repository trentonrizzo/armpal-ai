/**
 * Shared helpers for displaying stored workout timestamps in local device time.
 *
 * Supabase `timestamp` columns strip timezone info, so saved UTC values come
 * back as bare strings (e.g. "2026-05-12T19:16:00").  `new Date(bare)` would
 * treat that as local time — wrong.  These helpers append "Z" to bare strings
 * so they are correctly interpreted as UTC before converting to local.
 */

/** Parse a stored Supabase timestamp into a Date at the correct UTC instant. */
export function parseStoredTimestamp(raw) {
  if (raw == null) return null;
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  const hasOffset = /[Z]$/i.test(s) || /[+-]\d{2}(:\d{2})?$/.test(s);
  const d = new Date(hasOffset ? s : s + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a stored timestamp for display (e.g. "May 12, 2:16 PM"). */
export function formatStoredTimestamp(raw) {
  const d = parseStoredTimestamp(raw);
  if (!d) return "Not scheduled";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Convert a stored timestamp to `YYYY-MM-DDTHH:mm` in device-local time,
 * suitable for `<input type="datetime-local">`.
 */
export function storedTimestampToDatetimeLocal(raw) {
  const d = parseStoredTimestamp(raw);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
