/**
 * Recommended Friends: fetch from public profiles, compute match_score, return top 20.
 * Uses profiles (age, city, state, interests, profile_visibility) — not discovery_profiles.
 */
import { supabase } from "../supabaseClient";

const WARN_KEY = "armpal_recommended_friends_warned";

function warnOnce(message, detail) {
  if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(WARN_KEY)) return;
  if (typeof sessionStorage !== "undefined") sessionStorage.setItem(WARN_KEY, "1");
  console.warn("[recommendedFriends]", message, detail || "");
}

function normalizeStr(s) {
  return (s && String(s).trim().toLowerCase()) || "";
}

function sharedInterestsCount(mine, theirs) {
  if (!Array.isArray(mine) || !Array.isArray(theirs)) return 0;
  const set = new Set(theirs.map((x) => normalizeStr(x)));
  return mine.filter((x) => set.has(normalizeStr(x))).length;
}

function computeMatch(myRow, otherRow) {
  const myInterests = Array.isArray(myRow?.interests) ? myRow.interests : [];
  const otherInterests = Array.isArray(otherRow?.interests) ? otherRow.interests : [];
  const sharedCount = sharedInterestsCount(myInterests, otherInterests);

  const myCity = normalizeStr(myRow?.city);
  const otherCity = normalizeStr(otherRow?.city);
  const cityMatch = !!myCity && myCity === otherCity;

  const myState = normalizeStr(myRow?.state);
  const otherState = normalizeStr(otherRow?.state);
  const stateMatch = !!myState && myState === otherState;

  const myAge = myRow?.age != null ? Number(myRow.age) : null;
  const otherAge = otherRow?.age != null ? Number(otherRow.age) : null;
  const ageDiff = myAge != null && otherAge != null ? Math.abs(myAge - otherAge) : 999;
  const similarAge = ageDiff <= 5;

  const matchScore =
    sharedCount * 3 +
    (cityMatch ? 5 : 0) +
    (stateMatch ? 2 : 0) +
    (similarAge ? 1 : 0);

  const reasons = [];
  if (cityMatch) reasons.push("Same city");
  if (stateMatch) reasons.push("Same state");
  if (similarAge) reasons.push("Similar age");
  if (sharedCount > 0) reasons.push("Shared interests");

  return { matchScore, matchReasons: reasons };
}

function isMissingTableError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return msg.includes("discovery_profiles") || msg.includes("schema cache") || msg.includes("does not exist");
}

/**
 * @param {string} userId - current user id
 * @returns {Promise<{ list: Array<object>, count: number }>}
 */
export async function getRecommended(userId) {
  if (!userId) return { list: [], count: 0 };

  try {
    const { data: myRow, error: myErr } = await supabase
      .from("profiles")
      .select("id, age, city, state, interests, profile_visibility")
      .eq("id", userId)
      .maybeSingle();

    if (myErr) {
      if (!isMissingTableError(myErr)) warnOnce("my profile lookup failed", myErr.message);
      return { list: [], count: 0 };
    }

    let others = [];
    let othersError = null;

    let othersRes = await supabase
      .from("profiles")
      .select(
        "id, age, city, state, interests, profile_visibility, display_name, username, avatar_url, is_official"
      )
      .neq("id", userId)
      .eq("profile_visibility", "public");

    if (othersRes.error && /profile_visibility|column/i.test(othersRes.error.message || "")) {
      othersRes = await supabase
        .from("profiles")
        .select("id, age, city, state, interests, display_name, username, avatar_url, is_official")
        .neq("id", userId);
    }

    others = othersRes.data;
    othersError = othersRes.error;

    if (othersError) {
      if (!isMissingTableError(othersError)) warnOnce("recommended query failed", othersError.message);
      return { list: [], count: 0 };
    }

    const rows = others || [];
    const withScore = rows.map((row) => {
      const { matchScore, matchReasons } = computeMatch(myRow || {}, row);
      return {
        user_id: row.id,
        age: row.age,
        city: row.city,
        state: row.state,
        interests: row.interests,
        match_score: matchScore,
        match_reasons: matchReasons,
        display_name: row.display_name,
        username: row.username,
        avatar_url: row.avatar_url,
        is_official: row.is_official,
      };
    });

    withScore.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
    const top20 = withScore.slice(0, 20);

    return { list: top20, count: top20.length };
  } catch (e) {
    if (!isMissingTableError(e)) warnOnce("getRecommended error", e?.message || e);
    return { list: [], count: 0 };
  }
}
