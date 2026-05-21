import { supabase } from "../supabaseClient";

const ARMPAL_PROFILE_SELECT =
  "id, display_name, handle, username, avatar_url, is_official, is_coaching_account";

/**
 * Fetch the official @ARMPAL profile by username (case-insensitive).
 * @returns {Promise<object | null>}
 */
export async function getArmPalOfficialProfile() {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(ARMPAL_PROFILE_SELECT)
      .ilike("username", "ARMPAL")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[coaching] getArmPalOfficialProfile failed:", error.message);
      return null;
    }

    return data?.id ? data : null;
  } catch (err) {
    console.warn("[coaching] getArmPalOfficialProfile failed:", err?.message || err);
    return null;
  }
}
