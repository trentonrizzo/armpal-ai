const WRITE_TOOLS = new Set([
  "update_profile",
  "update_bio",
  "create_pr",
  "update_pr",
  "delete_pr",
  "save_estimated_pr",
  "create_workout",
  "rename_workout",
  "reschedule_workout",
  "update_workout",
  "add_workout_exercise",
  "update_workout_exercise",
  "remove_workout_exercise",
  "delete_workout",
  "create_goal",
  "update_goal",
  "delete_goal",
  "log_bodyweight",
  "update_bodyweight",
  "log_measurement",
  "update_measurement",
  "log_nutrition",
  "update_nutrition_goals",
]);

const SHORT_COMMANDS = new Set([
  "yes",
  "yeah",
  "yep",
  "yup",
  "no",
  "nope",
  "ok",
  "okay",
  "k",
  "done",
  "thanks",
  "thank you",
  "go",
  "next",
  "that",
  "this",
  "that one",
  "this one",
  "do it",
  "do that",
  "please",
  "sure",
  "correct",
  "right",
  "wait",
  "stop",
  "cancel",
]);

const DAYS = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "today",
  "tomorrow",
  "yesterday",
]);

const FITNESS_OR_COMMAND = /\b(bench|squat|deadlift|press|ohp|row|curl|pr|bio|workout|workouts|weight|weights|pound|pounds|lb|lbs|kg|kgs|rep|reps|set|sets|note|notes|log|update|change|add|move|delete|remove|create|save|goal|goals|calorie|calories|protein|carbs|fat|bodyweight|measurement|profile|heaviest|lift|wraps|elbow|tank|rir|rpe|when|what|what's|whats|how|my|the|a|to|for|on|and|put|used|had|another|in)\b/i;

const CANCEL_RE =
  /^(please\s+)?(stop(?:\s+that)?|cancel(?:\s+that)?|wait|hold\s+on|hold\s+up|never\s*mind|forget\s+it)([.!?]*)?$/i;

export function normalizeTranscript(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isWriteTool(name) {
  return WRITE_TOOLS.has(String(name || ""));
}

export function isIntentionalCancel(text) {
  const t = normalizeTranscript(text);
  if (!t) return false;
  return CANCEL_RE.test(t);
}

export function isLegitimateShortCommand(text) {
  const t = normalizeTranscript(text).replace(/[.!?]+$/g, "").toLowerCase();
  if (!t) return false;
  if (SHORT_COMMANDS.has(t) || DAYS.has(t)) return true;
  if (isIntentionalCancel(text)) return true;
  if (/^\d+([./]\d+)?(\s*(lb|lbs|kg|kgs|pounds?|reps?))?$/.test(t)) return true;
  return false;
}

function hasNonLatinScript(text) {
  return /[\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(text);
}

function latinLetterCount(text) {
  return (String(text).match(/[A-Za-z]/g) || []).length;
}

export function isLikelyNoiseTranscript(text) {
  const t = normalizeTranscript(text);
  if (!t) return true;
  if (isLegitimateShortCommand(t)) return false;
  if (isIntentionalCancel(t)) return false;
  if (hasNonLatinScript(t) && latinLetterCount(t) < 8 && !/\b(update|change|add|log|delete|move|save|create)\b/i.test(t)) {
    return true;
  }

  if (FITNESS_OR_COMMAND.test(t)) return false;
  if (/\d/.test(t)) return false;

  const words = t.replace(/[.!?]+$/g, "").split(" ").filter(Boolean);
  if (words.length <= 2) return true;
  return false;
}

export function shouldIgnoreUserTurn(text, ctx = {}) {
  const t = normalizeTranscript(text);
  if (!t) return true;
  if (isIntentionalCancel(t)) return false;
  if (isLegitimateShortCommand(t)) return false;
  if (ctx.activeWrite && isLikelyNoiseTranscript(t)) return true;
  return isLikelyNoiseTranscript(t);
}

export function canCancelActiveCommand(text) {
  return isIntentionalCancel(text);
}

export function evaluateUserTurn(text, ctx = {}) {
  const t = normalizeTranscript(text);
  if (canCancelActiveCommand(t)) {
    return { action: "cancel", text: t, display: true };
  }
  if (shouldIgnoreUserTurn(t, ctx)) {
    return { action: "ignore", text: t, display: false };
  }
  return { action: "accept", text: t, display: true };
}

export function shouldBlockWrite({ name, userTranscript } = {}) {
  if (!isWriteTool(name)) return false;
  const t = normalizeTranscript(userTranscript);
  if (!t) return false;
  if (canCancelActiveCommand(t)) return true;
  if (shouldIgnoreUserTurn(t)) return true;
  return false;
}

const TANK_POUNDS_RE = /(\d+(?:\.\d+)?)\s*(pounds?|lbs?)\s+in the tank/i;
const TANK_REPS_RE = /(\d+(?:\.\d+)?)\s*reps?\s+in (?:the )?tank/i;
const TANK_BARE_RE = /(\d+(?:\.\d+)?)\s+in the tank/i;
const TANK_RIR_RE = /(\d+(?:\.\d+)?)\s*reps?\s+in reserve/i;

export function preserveNoteFidelity(text, transcript) {
  if (text == null) return text;
  let next = String(text);
  const spoken = String(transcript || "");
  const pounds = spoken.match(TANK_POUNDS_RE);
  if (pounds && TANK_REPS_RE.test(next)) {
    next = next.replace(TANK_REPS_RE, `${pounds[1]} ${pounds[2]} in the tank`);
  }
  const rir = spoken.match(TANK_RIR_RE);
  if (rir && TANK_POUNDS_RE.test(next) && !TANK_POUNDS_RE.test(spoken)) {
    next = next.replace(TANK_POUNDS_RE, `${rir[1]} reps in reserve`);
  }
  return next;
}

export function noteNeedsUnitClarification(transcript) {
  const spoken = String(transcript || "");
  if (!TANK_BARE_RE.test(spoken)) return false;
  if (TANK_POUNDS_RE.test(spoken) || TANK_REPS_RE.test(spoken) || TANK_RIR_RE.test(spoken)) {
    return false;
  }
  if (/\d+(?:\.\d+)?\s*(pounds?|lbs?|kgs?|kilograms?|reps?)\b/i.test(spoken)) {
    return false;
  }
  return true;
}

export function applyTranscriptFidelity(args, transcript) {
  if (!args || typeof args !== "object") return args;
  const next = { ...args };
  if (next.notes != null) next.notes = preserveNoteFidelity(next.notes, transcript);
  if (next.bio != null) next.bio = preserveNoteFidelity(next.bio, transcript);
  return next;
}

export { WRITE_TOOLS };
