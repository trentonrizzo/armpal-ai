/**
 * Recommended Friends: fetch from discovery_profiles, compute match_score, return top 20.
 * Not pro-gated. All users have access.
 */
import { supabase } from "../supabaseClient";

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

/**
 * @param {string} userId - current user id
 * @returns {Promise<{ list: Array<{ user_id, age, city, state, interests, match_score, match_reasons, display_name?, username?, avatar_url? }>, count: number }>}
 */
export async function getRecommended(userId) {
  if (!userId) return { list: [], count: 0 };

  try {
    const { data: myRow } = await supabase
      .from("discovery_profiles")
      .select("age, city, state, interests")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: others, error: othersError } = await supabase
      .from("discovery_profiles")
      .select("user_id, age, city, state, interests")
      .neq("user_id", userId)
      .eq("visibility", "public");

    if (othersError) {
      console.error("recommendedFriends getRecommended:", othersError);
      return { list: [], count: 0 };
    }

    const rows = others || [];
    const withScore = rows.map((row) => {
      const { matchScore, matchReasons } = computeMatch(myRow || {}, row);
      return { ...row, match_score: matchScore, match_reasons: matchReasons };
    });

    withScore.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
    const top20 = withScore.slice(0, 20);
    const userIds = top20.map((r) => r.user_id).filter(Boolean);

    if (userIds.length === 0) return { list: [], count: 0 };

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", userIds);

    const profileMap = {};
    (profiles || []).forEach((p) => (profileMap[p.id] = p));

    const list = top20.map((r) => ({
      ...r,
      display_name: profileMap[r.user_id]?.display_name,
      username: profileMap[r.user_id]?.username,
      avatar_url: profileMap[r.user_id]?.avatar_url,
    }));

    return { list, count: list.length };
  } catch (e) {
    console.error("getRecommended error", e);
    return { list: [], count: 0 };
  }
}
