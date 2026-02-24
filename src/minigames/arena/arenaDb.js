/**
 * ArmPal Arena — Supabase CRUD + match end / stats updates
 * Join by 4-digit code (1000–9999); match UUID kept internal only.
 */
import { supabase } from "../../supabaseClient";

const JOIN_CODE_MIN = 1000;
const JOIN_CODE_MAX = 9999;
const MAX_JOIN_CODE_ATTEMPTS = 50;

/**
 * Find a join_code not used by any waiting or active match.
 */
async function findUnusedJoinCode() {
  for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt++) {
    const code = Math.floor(JOIN_CODE_MIN + Math.random() * (JOIN_CODE_MAX - JOIN_CODE_MIN + 1));
    const { data: existing } = await supabase
      .from("arena_matches")
      .select("id")
      .eq("join_code", code)
      .in("status", ["waiting", "active"])
      .maybeSingle();
    if (!existing) return code;
  }
  throw new Error("Could not generate unique join code; try again.");
}

/**
 * Create a match; host is slot1, slot2 is explicitly NULL. Generates unique 4-digit join_code.
 */
export async function createMatch(hostUserId) {
  const join_code = await findUnusedJoinCode();
  const { data, error } = await supabase
    .from("arena_matches")
    .insert({
      host_user_id: hostUserId,
      slot1_user_id: hostUserId,
      slot2_user_id: null,
      status: "waiting",
      join_code,
    })
    .select("id, status, host_user_id, slot1_user_id, slot2_user_id, join_code, created_at")
    .single();
  if (error) throw error;
  await supabase.from("arena_match_players").insert({
    match_id: data.id,
    user_id: hostUserId,
    slot: 1,
  });
  return data;
}

export async function getMatch(matchId) {
  const { data, error } = await supabase
    .from("arena_matches")
    .select("*")
    .eq("id", matchId)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Join a match by 4-digit code. Fills slot2 only if empty; rejects if match full or user is host.
 */
export async function joinByCode(joinCode, userId) {
  const code = typeof joinCode === "string" ? parseInt(joinCode.trim(), 10) : joinCode;
  if (!Number.isInteger(code) || code < JOIN_CODE_MIN || code > JOIN_CODE_MAX) {
    throw new Error("Enter a 4-digit code (1000–9999).");
  }

  const { data: match, error: fetchError } = await supabase
    .from("arena_matches")
    .select("id, slot1_user_id, slot2_user_id, status")
    .eq("join_code", code)
    .eq("status", "waiting")
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!match) throw new Error("Match not found");
  if (match.slot2_user_id) throw new Error("Match full");
  if (match.slot1_user_id === userId) throw new Error("You are the host; cannot join as player 2.");

  const { error: updateErr } = await supabase
    .from("arena_matches")
    .update({ slot2_user_id: userId })
    .eq("id", match.id);
  if (updateErr) throw updateErr;

  const { error: insertErr } = await supabase.from("arena_match_players").insert({
    match_id: match.id,
    user_id: userId,
    slot: 2,
  });
  if (insertErr) throw insertErr;

  return getMatch(match.id);
}

export async function setMatchActive(matchId, hostUserId) {
  const { data: match } = await supabase
    .from("arena_matches")
    .select("host_user_id, slot2_user_id")
    .eq("id", matchId)
    .single();
  if (!match || match.host_user_id !== hostUserId || !match.slot2_user_id) {
    throw new Error("Only host can start when both slots filled");
  }
  const { error } = await supabase
    .from("arena_matches")
    .update({ status: "active", started_at: new Date().toISOString() })
    .eq("id", matchId);
  if (error) throw error;
  return getMatch(matchId);
}

export async function endMatch(matchId, winnerUserId) {
  const { error } = await supabase
    .from("arena_matches")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      winner_user_id: winnerUserId || null,
      left_by_user_id: null,
    })
    .eq("id", matchId);
  if (error) throw error;
}

/**
 * Leave match immediately. Sets status=ended, winner=other player, left_by_user_id=userId.
 * Opponent will see "Opponent left" and return to lobby after 2–3s.
 */
export async function leaveMatch(matchId, userIdWhoLeft) {
  const match = await getMatch(matchId);
  if (!match || match.status !== "active") return;
  const otherUserId =
    match.slot1_user_id === userIdWhoLeft ? match.slot2_user_id : match.slot1_user_id;
  const { error } = await supabase
    .from("arena_matches")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      winner_user_id: otherUserId || null,
      left_by_user_id: userIdWhoLeft,
    })
    .eq("id", matchId);
  if (error) throw error;
}

export async function getMatchPlayers(matchId) {
  const { data, error } = await supabase
    .from("arena_match_players")
    .select("user_id, slot, kills, deaths")
    .eq("match_id", matchId);
  if (error) throw error;
  return data || [];
}

export async function updateMatchPlayerKillsDeaths(matchId, userId, kills, deaths) {
  const { error } = await supabase
    .from("arena_match_players")
    .update({ kills, deaths })
    .eq("match_id", matchId)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Persist one user's stats after match end. Call from each client for their own user_id (RLS).
 */
export async function persistMatchResult(matchId, userId) {
  const match = await getMatch(matchId);
  if (match.status !== "ended") return;
  const players = await getMatchPlayers(matchId);
  const row = players.find((p) => p.user_id === userId);
  if (!row) return;

  const winnerId = match.winner_user_id || null;
  const isWinner = row.user_id === winnerId;
  const { data: existing } = await supabase
    .from("arena_player_stats")
    .select("matches_played, wins, losses, kills, deaths, rating")
    .eq("user_id", row.user_id)
    .maybeSingle();

  const prev = existing || {
    matches_played: 0,
    wins: 0,
    losses: 0,
    kills: 0,
    deaths: 0,
    rating: 1000,
  };
  const ratingDelta = isWinner ? 15 : -15;
  const next = {
    matches_played: prev.matches_played + 1,
    wins: prev.wins + (isWinner ? 1 : 0),
    losses: prev.losses + (isWinner ? 0 : 1),
    kills: prev.kills + (row.kills || 0),
    deaths: prev.deaths + (row.deaths || 0),
    rating: Math.max(0, prev.rating + ratingDelta),
    updated_at: new Date().toISOString(),
  };
  await supabase.from("arena_player_stats").upsert(
    { user_id: row.user_id, ...next },
    { onConflict: "user_id" }
  );
}

export async function getArenaLeaderboard(limit = 25) {
  const { data, error } = await supabase
    .from("arena_leaderboard")
    .select("*")
    .limit(limit);
  if (error) throw error;
  return data || [];
}

const DEFAULT_ARENA_SETTINGS = {
  look_sensitivity_x: 0.0009,
  look_sensitivity_y: 0.0009,
  invert_y_axis: false,
  fov: 85,
  controller_sensitivity: 1,
  mouse_sensitivity: 1,
  touch_sensitivity: 1,
  movement_smoothing: 0.2,
  character_model: "block",
  weapon_choice: "pistol",
  crosshair_style: "cross",
  ads_sensitivity: 0.5,
  controller_deadzone: 0.15,
  sprint_toggle: false,
  control_device: "auto",
  jump_button_position: "right",
  camera_mode: "first",
  loadout_primary: "pistol",
  loadout_secondary: "shotgun",
};

export function getDefaultArenaSettings() {
  return { ...DEFAULT_ARENA_SETTINGS };
}

export async function getArenaSettings(userId) {
  if (!userId) return getDefaultArenaSettings();
  const { data, error } = await supabase
    .from("arena_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return getDefaultArenaSettings();
  return { ...DEFAULT_ARENA_SETTINGS, ...data };
}

export async function saveArenaSettings(userId, settings) {
  if (!userId) throw new Error("User required");
  const row = {
    user_id: userId,
    ...settings,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("arena_settings").upsert(row, {
    onConflict: "user_id",
  });
  if (error) throw error;
}

const DEFAULT_BINDS = {
  keyboard: {
    move_forward: "KeyW",
    move_back: "KeyS",
    move_left: "KeyA",
    move_right: "KeyD",
    jump: "Space",
    sprint: "ShiftLeft",
    crouch: "KeyC",
    crouch_hold: "ControlLeft",
    fire: "Mouse0",
    aim: "Mouse1",
    reload: "KeyR",
    weapon_1: "Digit1",
    weapon_2: "Digit2",
    weapon_3: "Digit3",
    interact: "KeyF",
    scoreboard: "Tab",
    pause: "Escape",
    camera_toggle: "KeyV",
  },
  gamepad: {
    move_axis_x: "0",
    move_axis_y: "1",
    look_axis_x: "2",
    look_axis_y: "3",
    jump: "0",
    crouch: "1",
    fire: "7",
    aim: "6",
    reload: "2",
    weapon_swap: "3",
    pause: "9",
    camera_toggle: "10",
  },
  mobile: { fire_pos: "right", jump_pos: "right", crouch_pos: "right", aim_pos: "right", swap_pos: "right", reload_pos: "right" },
};

export function getDefaultArenaBinds() {
  return JSON.parse(JSON.stringify(DEFAULT_BINDS));
}

export async function getArenaBinds(userId) {
  if (!userId) return getDefaultArenaBinds();
  const { data, error } = await supabase
    .from("arena_binds")
    .select("device_type, binds_json")
    .eq("user_id", userId);
  if (error) throw error;
  const out = getDefaultArenaBinds();
  (data || []).forEach((row) => {
    if (row.device_type && row.binds_json) {
      out[row.device_type] = { ...out[row.device_type], ...row.binds_json };
    }
  });
  return out;
}

export async function saveArenaBinds(userId, binds) {
  if (!userId) throw new Error("User required");
  for (const device of ["keyboard", "gamepad", "mobile"]) {
    const payload = binds[device] != null ? binds[device] : DEFAULT_BINDS[device];
    const { error } = await supabase.from("arena_binds").upsert(
      {
        user_id: userId,
        device_type: device,
        binds_json: payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,device_type" }
    );
    if (error) throw error;
  }
}
