import { supabase } from "../supabaseClient";

const OFFICIAL_PROFILE_SELECT =
  "id, display_name, handle, username, avatar_url, is_official, is_coaching_account";

/**
 * Fetch the official ArmPal coaching profile from Supabase.
 * @returns {Promise<object | null>}
 */
export async function getOfficialCoachingAccount() {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(OFFICIAL_PROFILE_SELECT)
      .eq("is_official", true)
      .eq("is_coaching_account", true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[coaching] getOfficialCoachingAccount failed:", error.message);
      return null;
    }

    return data?.id ? data : null;
  } catch (err) {
    console.warn("[coaching] getOfficialCoachingAccount failed:", err?.message || err);
    return null;
  }
}
