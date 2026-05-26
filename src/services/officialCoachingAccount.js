import { supabase } from "../supabaseClient";

export const OFFICIAL_ARMPAL_PROFILE_ID = "d281c04d-338f-4809-8709-03e7594a074c";

const OFFICIAL_PROFILE_SELECT =
  "id, display_name, handle, username, avatar_url, is_official, is_coaching_account, role";

const OFFICIAL_PROFILE_FALLBACK = {
  id: OFFICIAL_ARMPAL_PROFILE_ID,
  display_name: "ARMPAL",
  handle: "armpal",
  username: "armpal",
  avatar_url: null,
  is_official: true,
  is_coaching_account: true,
};

/**
 * Official @armpal coaching profile (direct profiles.id lookup).
 * @returns {Promise<object>}
 */
export async function getOfficialArmPalProfile() {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(OFFICIAL_PROFILE_SELECT)
      .eq("id", OFFICIAL_ARMPAL_PROFILE_ID)
      .maybeSingle();

    if (error) {
      console.warn("[coaching] official profile fetch failed:", error.message);
    }

    if (data?.id) {
      console.log("Official ArmPal lookup result:", data);
      return data;
    }
  } catch (err) {
    console.warn("[coaching] official profile fetch failed:", err?.message || err);
  }

  console.log("Official ArmPal lookup result:", OFFICIAL_PROFILE_FALLBACK);
  return OFFICIAL_PROFILE_FALLBACK;
}

/** @deprecated Use getOfficialArmPalProfile */
export const getArmPalOfficialProfile = getOfficialArmPalProfile;
