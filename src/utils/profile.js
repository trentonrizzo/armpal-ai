// src/utils/profile.js
import { supabase } from "../supabaseClient";

/* ============================================================
   FETCH CURRENT USER
============================================================ */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

/* ============================================================
   FETCH PROFILE
============================================================ */
export async function fetchProfile(userId = null) {
  const user = userId || (await getCurrentUser())?.id;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

/* ============================================================
   CREATE PROFILE IF IT DOESN'T EXIST
============================================================ */
export async function createProfileIfMissing() {
  const user = await getCurrentUser();
  if (!user) return null;

  const existing = await fetchProfile(user.id);

  const referredBy =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("armpal_referral_ref")
      : null;

  if (existing) {
    if (referredBy && !existing.referred_by) {
      await supabase.from("profiles").update({ referred_by: referredBy }).eq("id", user.id);
      if (typeof localStorage !== "undefined") localStorage.removeItem("armpal_referral_ref");
    }
    return existing;
  }

  const { data, error } = await supabase.from("profiles").insert([
    {
      id: user.id,
      email: user.email,
      username: null,
      bio: "",
      avatar_url: "",
      ...(referredBy && { referred_by: referredBy }),
    },
  ]);

  if (referredBy && typeof localStorage !== "undefined") {
    localStorage.removeItem("armpal_referral_ref");
  }

  if (error) throw error;
  return data;
}

/* ============================================================
   UPDATE PROFILE
============================================================ */
export async function updateProfile(updates) {
  const user = await getCurrentUser();

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) throw error;
}

/* ============================================================
   UPLOAD AVATAR
============================================================ */
export async function uploadAvatar(file) {
  const user = await getCurrentUser();
  if (!user) return null;

  const ext = file.name.split(".").pop();
  const filePath = `avatars/${user.id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = await supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/* ============================================================
   REQUIRE USERNAME (FORCE SETUP)
============================================================ */
export async function requireUsername(navigate) {
  const profile = await fetchProfile();
  if (!profile?.username || profile.username.trim() === "") {
    navigate("/profile");
    return false;
  }
  return true;
}
