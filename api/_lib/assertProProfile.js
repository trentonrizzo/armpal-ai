export async function assertProProfile(supabase, userId) {
  if (!userId) {
    return { ok: false, status: 401, error: "PRO_REQUIRED", message: "Sign in to use this feature." };
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("is_pro")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    return { ok: false, status: 500, error: "PRO_REQUIRED", message: "Couldn't verify Pro status." };
  }
  if (!data?.is_pro) {
    return {
      ok: false,
      status: 403,
      error: "PRO_REQUIRED",
      message: "ArmPal Pro is required for this feature.",
    };
  }
  return { ok: true };
}
