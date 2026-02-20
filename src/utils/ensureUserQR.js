/**
 * ArmPal: ensure the current user has a permanent QR code (backend-generated, stored in profiles).
 * Call after signup success and on session restore. Idempotent; safe to call multiple times.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<void>}
 */
export async function ensureUserQR(supabase) {
  if (!supabase) return;
  try {
    await supabase.functions.invoke("ensure-user-qr", {
      method: "POST",
      body: {},
    });
  } catch (_) {
    // Fire-and-forget; do not block UI or surface errors
  }
}
