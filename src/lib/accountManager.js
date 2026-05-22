import { supabase } from "../supabaseClient";

export const SAVED_ACCOUNTS_STORAGE_KEY = "armpal_saved_accounts";

function safeParseAccounts(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SAVED_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.warn("[accountManager] write failed:", err?.message || err);
  }
}

function normalizeAccount(entry) {
  if (!entry?.userId || !entry?.access_token || !entry?.refresh_token) return null;
  return {
    userId: String(entry.userId),
    email: entry.email || "",
    displayName: entry.displayName || entry.email || "Account",
    avatarUrl: entry.avatarUrl || "",
    username: entry.username || "",
    handle: entry.handle || "",
    role: entry.role || "",
    isOfficial: !!entry.isOfficial,
    isCoaching: !!entry.isCoaching,
    access_token: entry.access_token,
    refresh_token: entry.refresh_token,
    savedAt: entry.savedAt || Date.now(),
  };
}

/**
 * @returns {Array<object>}
 */
export function getSavedAccounts() {
  if (typeof localStorage === "undefined") return [];
  return safeParseAccounts(localStorage.getItem(SAVED_ACCOUNTS_STORAGE_KEY))
    .map(normalizeAccount)
    .filter(Boolean)
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

/**
 * @param {string} userId
 * @returns {boolean}
 */
export function isAccountAlreadySaved(userId) {
  if (!userId) return false;
  return getSavedAccounts().some((a) => a.userId === userId);
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {object | null | undefined} profile
 */
export async function saveCurrentAccount(session, profile) {
  if (!session?.user?.id || !session.access_token || !session.refresh_token) return;

  const userId = session.user.id;
  const accounts = getSavedAccounts();
  const existing = accounts.find((a) => a.userId === userId);

  const nextEntry = normalizeAccount({
    userId,
    email: session.user.email || existing?.email || "",
    displayName:
      profile?.display_name ||
      profile?.username ||
      profile?.handle ||
      existing?.displayName ||
      session.user.email?.split("@")[0] ||
      "Account",
    avatarUrl: profile?.avatar_url || existing?.avatarUrl || "",
    username: profile?.username || existing?.username || "",
    handle: profile?.handle || existing?.handle || "",
    role: profile?.role || existing?.role || "",
    isOfficial:
      profile?.is_official === true || existing?.isOfficial === true || false,
    isCoaching:
      profile?.is_coaching_account === true || existing?.isCoaching === true || false,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    savedAt: Date.now(),
  });

  if (!nextEntry) return;

  const withoutDup = accounts.filter((a) => a.userId !== userId);
  writeAccounts([nextEntry, ...withoutDup]);
}

/**
 * Persist the active Supabase session + profile into saved accounts.
 */
export async function syncCurrentSession() {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.user?.id) return;

    let profile = null;
    try {
      const { data } = await supabase
        .from("profiles")
        .select(
          "display_name, username, handle, avatar_url, role, is_official, is_coaching_account"
        )
        .eq("id", session.user.id)
        .maybeSingle();
      profile = data || null;
    } catch (profileErr) {
      console.warn("[accountManager] profile fetch failed:", profileErr?.message || profileErr);
    }

    await saveCurrentAccount(session, profile);
  } catch (err) {
    console.warn("[accountManager] syncCurrentSession failed:", err?.message || err);
  }
}

/**
 * @param {object} account
 * @returns {Promise<import('@supabase/supabase-js').Session | null>}
 */
export async function switchToAccount(account) {
  const normalized = normalizeAccount(account);
  if (!normalized) {
    throw new Error("Invalid saved account");
  }

  await syncCurrentSession();

  const { data, error } = await supabase.auth.setSession({
    access_token: normalized.access_token,
    refresh_token: normalized.refresh_token,
  });

  if (error) {
    throw error;
  }

  if (data?.session) {
    await saveCurrentAccount(data.session, null);
    await syncCurrentSession();
    return data.session;
  }

  return null;
}

/**
 * @param {string} userId
 * @returns {Array<object>}
 */
export function removeSavedAccount(userId) {
  if (!userId) return getSavedAccounts();
  const next = getSavedAccounts().filter((a) => a.userId !== userId);
  writeAccounts(next);
  return next;
}
