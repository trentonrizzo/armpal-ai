/**
 * ArmPal Arena — pistol, shotgun, sniper. Ammo (mag + reserve), reload, swap.
 * Damage: head 2x, body 1x, limbs 0.75x.
 */

export const WEAPONS = {
  pistol: {
    id: "pistol",
    name: "Pistol",
    semi: true,
    damageBody: 20,
    damageHead: 40,
    damageLimb: 15,
    fireRateMs: 180,
    magSize: 12,
    reserve: 48,
    recoilPitch: 0.02,
    tracer: true,
    range: 80,
  },
  shotgun: {
    id: "shotgun",
    name: "Shotgun",
    semi: true,
    pellets: 9,
    damageBodyPerPellet: 12,
    damageHeadPerPellet: 24,
    damageLimbPerPellet: 9,
    fireRateMs: 900,
    magSize: 6,
    reserve: 24,
    spreadDeg: 8,
    recoilPitch: 0.04,
    tracer: true,
    range: 25,
    falloffStart: 8,
    falloffEnd: 25,
  },
  sniper: {
    id: "sniper",
    name: "Sniper",
    semi: true,
    damageBody: 80,
    damageHead: 160,
    damageLimb: 60,
    fireRateMs: 1200,
    magSize: 5,
    reserve: 20,
    recoilPitch: 0.08,
    tracer: true,
    scope: true,
    range: 120,
  },
};

export function createWeaponState(primaryId, secondaryId) {
  const primary = WEAPONS[primaryId] || WEAPONS.pistol;
  const secondary = WEAPONS[secondaryId] || WEAPONS.shotgun;
  return {
    loadout: [primary.id, secondary.id],
    currentIndex: 0,
    current: primary.id,
    mag: { [primary.id]: primary.magSize, [secondary.id]: secondary.magSize },
    reserve: { [primary.id]: primary.reserve, [secondary.id]: secondary.reserve },
    lastShotTs: 0,
    reloading: null,
    reloadEndTs: 0,
  };
}

export function getCurrentWeapon(state) {
  return WEAPONS[state.current] || WEAPONS.pistol;
}

export function canFire(state, now) {
  const w = getCurrentWeapon(state);
  if (state.reloading) return false;
  if ((state.mag[state.current] ?? 0) <= 0) return false;
  if (now - state.lastShotTs < w.fireRateMs) return false;
  return true;
}

export function consumeAmmo(state) {
  const cur = state.current;
  const m = (state.mag[cur] ?? 0) - 1;
  state.mag[cur] = Math.max(0, m);
  return state;
}

export function startReload(state, now) {
  const w = getCurrentWeapon(state);
  const inMag = state.mag[state.current] ?? 0;
  const inReserve = state.reserve[state.current] ?? 0;
  if (inMag >= w.magSize || inReserve <= 0) return state;
  const toLoad = Math.min(w.magSize - inMag, inReserve);
  const reloadMs = 1800;
  return {
    ...state,
    reloading: state.current,
    reloadEndTs: now + reloadMs,
    _reloadToLoad: toLoad,
  };
}

export function tickReload(state, now) {
  if (!state.reloading || now < state.reloadEndTs) return state;
  const w = WEAPONS[state.reloading];
  const toLoad = state._reloadToLoad ?? 0;
  const newMag = (state.mag[state.reloading] ?? 0) + toLoad;
  const newReserve = (state.reserve[state.reloading] ?? 0) - toLoad;
  return {
    ...state,
    mag: { ...state.mag, [state.reloading]: newMag },
    reserve: { ...state.reserve, [state.reloading]: Math.max(0, newReserve) },
    reloading: null,
    reloadEndTs: 0,
    _reloadToLoad: undefined,
  };
}

export function swapWeapon(state) {
  const idx = (state.currentIndex + 1) % state.loadout.length;
  const next = state.loadout[idx];
  return {
    ...state,
    currentIndex: idx,
    current: next,
    reloading: null,
  };
}

export function switchToSlot(state, slot) {
  if (slot < 1 || slot > state.loadout.length) return state;
  const idx = slot - 1;
  const next = state.loadout[idx];
  return {
    ...state,
    currentIndex: idx,
    current: next,
    reloading: null,
  };
}

export function computeDamage(weaponId, hitPart, distance) {
  const w = WEAPONS[weaponId];
  if (!w) return 0;
  let dmg = 0;
  if (w.pellets) {
    const perPellet = hitPart === "head" ? w.damageHeadPerPellet : hitPart === "limb" ? w.damageLimbPerPellet : w.damageBodyPerPellet;
    let falloff = 1;
    if (w.falloffStart != null && w.falloffEnd != null && distance > w.falloffStart) {
      const t = (distance - w.falloffStart) / (w.falloffEnd - w.falloffStart);
      falloff = Math.max(0.3, 1 - t);
    }
    dmg = Math.floor(perPellet * w.pellets * falloff);
  } else {
    dmg = hitPart === "head" ? w.damageHead : hitPart === "limb" ? w.damageLimb : w.damageBody;
  }
  return Math.max(1, dmg);
}
