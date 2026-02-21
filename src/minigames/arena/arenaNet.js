/**
 * ArmPal Arena — Supabase Realtime channel wrapper for arena:<match_id>
 * Broadcast: snapshot (10 Hz), hit (on shoot hit)
 */
import { supabase } from "../../supabaseClient";

const CHANNEL_PREFIX = "arena:";

export function getChannelName(matchId) {
  return `${CHANNEL_PREFIX}${matchId}`;
}

/**
 * @param {string} matchId
 * @param {(payload: { type: string, [k: string]: any }) => void} onBroadcast
 * @returns {() => void} unsubscribe
 */
export function subscribeArena(matchId, onBroadcast) {
  const channel = supabase.channel(getChannelName(matchId), {
    config: { broadcast: { self: true } },
  });
  channel.on("broadcast", { event: "payload" }, ({ payload }) => {
    if (payload && typeof payload === "object" && payload.type) {
      onBroadcast(payload);
    }
  });
  channel.subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * @param {string} matchId
 * @param {object} payload
 */
export function broadcast(matchId, payload) {
  const channel = supabase.channel(getChannelName(matchId));
  channel.send({
    type: "broadcast",
    event: "payload",
    payload,
  });
}

export function broadcastSnapshot(matchId, data) {
  broadcast(matchId, {
    type: "snapshot",
    userId: data.userId,
    pos: data.pos,
    rotY: data.rotY,
    pitch: data.pitch,
    health: data.health,
    kills: data.kills,
    deaths: data.deaths,
    isCrouching: data.isCrouching ?? false,
    currentWeapon: data.currentWeapon ?? "pistol",
    ts: Date.now(),
  });
}

export function broadcastHit(matchId, data) {
  broadcast(matchId, {
    type: "hit",
    shooterId: data.shooterId,
    victimId: data.victimId,
    damage: data.damage,
    hitPart: data.hitPart,
    ts: Date.now(),
  });
}

export function broadcastWeaponFire(matchId, data) {
  broadcast(matchId, {
    type: "weapon_fire",
    userId: data.userId,
    weapon: data.weapon,
    origin: data.origin,
    dir: data.dir,
    ts: Date.now(),
  });
}

export function broadcastLeave(matchId, userId) {
  broadcast(matchId, { type: "leave", userId, ts: Date.now() });
}

export function broadcastDeath(matchId, victimId, killerId) {
  broadcast(matchId, { type: "death", victimId, killerId, ts: Date.now() });
}
