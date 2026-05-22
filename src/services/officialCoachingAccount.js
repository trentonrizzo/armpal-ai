import { supabase } from "../supabaseClient";

const OFFICIAL_PROFILE_SELECT =
  "id, display_name, handle, username, avatar_url, is_official, is_coaching_account, role";

function pickProfile(data) {
  if (Array.isArray(data)) return data.find((row) => row?.id) || null;
  return data?.id ? data : null;
}

async function runLookup(label, queryPromise) {
  try {
    const { data, error } = await queryPromise;
    if (error) {
      console.warn(`[coaching] official lookup (${label}) failed:`, error.message);
      return null;
    }
    return pickProfile(data);
  } catch (err) {
    console.warn(`[coaching] official lookup (${label}) failed:`, err?.message || err);
    return null;
  }
}

/**
 * Flexible official @ARMPAL profile lookup (same profiles table as Add Friend).
 * @returns {Promise<object | null>}
 */
export async function getOfficialArmPalProfile() {
  const lookups = [
    [
      "flags",
      supabase
        .from("profiles")
        .select(OFFICIAL_PROFILE_SELECT)
        .eq("is_official", true)
        .eq("is_coaching_account", true)
        .limit(1)
        .maybeSingle(),
    ],
    [
      "handle-exact",
      supabase
        .from("profiles")
        .select(OFFICIAL_PROFILE_SELECT)
        .ilike("handle", "armpal")
        .limit(1)
        .maybeSingle(),
    ],
    [
      "username-exact",
      supabase
        .from("profiles")
        .select(OFFICIAL_PROFILE_SELECT)
        .ilike("username", "armpal")
        .limit(1)
        .maybeSingle(),
    ],
    [
      "handle-contains",
      supabase
        .from("profiles")
        .select(OFFICIAL_PROFILE_SELECT)
        .ilike("handle", "%armpal%")
        .limit(1)
        .maybeSingle(),
    ],
    [
      "username-contains",
      supabase
        .from("profiles")
        .select(OFFICIAL_PROFILE_SELECT)
        .ilike("username", "%armpal%")
        .limit(1)
        .maybeSingle(),
    ],
    [
      "display-name",
      supabase
        .from("profiles")
        .select(OFFICIAL_PROFILE_SELECT)
        .ilike("display_name", "%armpal%")
        .limit(1)
        .maybeSingle(),
    ],
    [
      "official-flag",
      supabase
        .from("profiles")
        .select(OFFICIAL_PROFILE_SELECT)
        .eq("is_official", true)
        .limit(1)
        .maybeSingle(),
    ],
  ];

  for (const [label, queryPromise] of lookups) {
    const profile = await runLookup(label, queryPromise);
    if (profile?.id) {
      console.log("Official ArmPal lookup result:", profile);
      return profile;
    }
  }

  console.log("Official ArmPal lookup result:", null);
  return null;
}

/** @deprecated Use getOfficialArmPalProfile */
export const getArmPalOfficialProfile = getOfficialArmPalProfile;
