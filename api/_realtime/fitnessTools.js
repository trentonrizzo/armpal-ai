import { buildDisplayText } from "../../src/utils/displayText.js";
import { estimateOneRepMax } from "../../src/lib/oneRepMax.js";
import { findMatchingPrs, resolvePrWrite, scoreLiftName } from "../../src/lib/liftMatch.js";
import { displayUnit, toPounds } from "../../src/lib/unitConvert.js";
import {
  hmInTimeZone,
  isValidTimeZone,
  isYmd,
  storedInstantToYmd,
  ymdInTimeZone,
  zonedLocalToUtcIso,
  parseStoredTimestamp,
} from "../../src/lib/localDates.js";
import { TOOL_ALIASES } from "./toolCatalog.js";
import {
  applyTranscriptFidelity,
  noteNeedsUnitClarification,
  shouldBlockWrite,
} from "../../src/features/voice/voiceTurnSafety.js";

function ok(data = {}) {
  return { ok: true, ...data };
}

function fail(message, extra = {}) {
  return { ok: false, error: message, ...extra };
}

function compactPr(pr) {
  if (!pr) return null;
  return {
    id: pr.id,
    lift_name: pr.lift_name,
    weight: pr.weight,
    reps: pr.reps,
    unit: pr.unit || "lb",
    date: pr.date,
    notes: pr.notes || null,
  };
}

function compactWorkout(w) {
  if (!w) return null;
  const exercises = Array.isArray(w.exercises) ? w.exercises : [];
  return {
    id: w.id,
    name: w.name,
    scheduled_for: w.scheduled_for,
    position: w.position,
    exercises: exercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      sets: ex.sets ?? null,
      reps: ex.reps ?? null,
      weight: ex.weight ?? null,
      input: ex.input ?? ex.display_text ?? null,
    })),
  };
}

function todayYmd(timeZone) {
  return ymdInTimeZone(new Date(), timeZone || "UTC");
}

function normalizeTimeZone(timeZone) {
  return isValidTimeZone(timeZone) ? timeZone : "UTC";
}

export function makeExercise(ex, index = 0) {
  const name = String(ex?.name || ex?.exercise || "Exercise").trim() || "Exercise";
  const hasSets = ex?.sets != null && ex.sets !== "";
  const hasReps = ex?.reps != null && ex.reps !== "";
  const id = ex?.id || `e-${Date.now()}-${index}`;
  if (hasSets || hasReps) {
    const structured = {
      name,
      sets: hasSets ? Number(ex.sets) : null,
      reps: hasReps ? Number(ex.reps) : null,
      weight: ex.weight == null || ex.weight === "" ? null : String(ex.weight),
    };
    return {
      id,
      ...structured,
      display_text: buildDisplayText(structured),
      input: null,
    };
  }
  const input = String(ex?.input || ex?.display_text || ex?.weight || "").trim();
  return {
    id,
    name,
    sets: null,
    reps: null,
    weight: null,
    input: input || null,
    display_text: input || name,
  };
}

async function loadPrs(supabase, userId) {
  const { data, error } = await supabase
    .from("prs")
    .select("id, user_id, lift_name, weight, reps, unit, date, notes, created_at")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  if (error) return { error: "I couldn't load your PRs." };
  return { prs: data || [] };
}

async function loadWorkouts(supabase, userId) {
  const { data, error } = await supabase
    .from("workouts")
    .select("id, user_id, name, scheduled_for, position, exercises, created_at")
    .eq("user_id", userId)
    .order("position", { ascending: true });
  if (error) return { error: "I couldn't load your workouts." };
  return { workouts: data || [] };
}

function workoutsOnDate(workouts, dateYmd, timeZone) {
  return (workouts || []).filter((w) => {
    if (!w.scheduled_for) return false;
    return storedInstantToYmd(w.scheduled_for, timeZone) === dateYmd;
  });
}

function resolveWorkout(workouts, { workout_id, name_query, scheduled_date }, timeZone) {
  const list = workouts || [];
  if (workout_id) {
    const hit = list.find((w) => w.id === workout_id);
    if (!hit) return { error: "I couldn't find that workout." };
    return { workout: hit };
  }
  let candidates = list;
  if (scheduled_date && isYmd(scheduled_date)) {
    candidates = workoutsOnDate(candidates, scheduled_date, timeZone);
  }
  if (name_query) {
    const q = String(name_query).toLowerCase();
    candidates = candidates.filter((w) =>
      String(w.name || "").toLowerCase().includes(q)
    );
  }
  if (candidates.length === 1) return { workout: candidates[0] };
  if (candidates.length > 1) {
    return {
      ambiguous: true,
      candidates: candidates.slice(0, 6).map(compactWorkout),
    };
  }
  return { error: "I couldn't find that workout." };
}

async function getProfile(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, handle, bio, profile_visibility, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) return fail("I couldn't load your profile.");
  return ok({
    profile: {
      display_name: data?.display_name || "",
      handle: data?.handle || "",
      bio: data?.bio || "",
      profile_visibility: data?.profile_visibility || "public",
    },
  });
}

export async function executeFitnessTool({
  name,
  args,
  user,
  supabase,
  timeZone: tzRaw,
  userTranscript = "",
}) {
  const timeZone = normalizeTimeZone(tzRaw);
  const userId = user.id;
  const toolName = TOOL_ALIASES[name] || name;
  if (
    shouldBlockWrite({
      name: toolName,
      userTranscript,
    })
  ) {
    return ok({ ignored: true, skipped: true });
  }
  let a = args && typeof args === "object" ? { ...args } : {};
  a = applyTranscriptFidelity(a, userTranscript);
  if (
    (a.notes != null || a.bio != null) &&
    noteNeedsUnitClarification(userTranscript)
  ) {
    return ok({
      needs_confirmation: true,
      message: "Did you mean pounds left in the tank, or reps?",
    });
  }

  switch (toolName) {
    case "get_profile":
      return getProfile(supabase, userId);

    case "get_prs": {
      const loaded = await loadPrs(supabase, userId);
      if (loaded.error) return fail(loaded.error);
      let rows = loaded.prs;
      if (a.lift_query) {
        const matches = findMatchingPrs(rows, a.lift_query);
        rows = matches.map((m) => m.pr);
        if (!rows.length) return ok({ prs: [], message: `No ${a.lift_query} PRs found.` });
      }
      return ok({ prs: rows.map(compactPr) });
    }

    case "get_heaviest_pr": {
      const loaded = await loadPrs(supabase, userId);
      if (loaded.error) return fail(loaded.error);
      if (!loaded.prs.length) return ok({ pr: null, message: "No PRs logged." });
      let best = null;
      let bestLb = -1;
      for (const pr of loaded.prs) {
        const lb = toPounds(pr.weight, pr.unit);
        if (lb == null) continue;
        if (lb > bestLb) {
          bestLb = lb;
          best = pr;
        }
      }
      return ok({ pr: compactPr(best) });
    }

    case "list_workouts": {
      const loaded = await loadWorkouts(supabase, userId);
      if (loaded.error) return fail(loaded.error);
      let rows = loaded.workouts;
      if (a.date && isYmd(a.date)) {
        rows = workoutsOnDate(rows, a.date, timeZone);
      }
      return ok({ workouts: rows.map(compactWorkout), date: a.date || null });
    }

    case "get_workout": {
      const loaded = await loadWorkouts(supabase, userId);
      if (loaded.error) return fail(loaded.error);
      const found = resolveWorkout(loaded.workouts, a, timeZone);
      if (found.error) return fail(found.error);
      if (found.ambiguous) return fail("I found more than one workout. Which one?", found);
      return ok({ workout: compactWorkout(found.workout) });
    }

    case "get_upcoming_workouts": {
      const loaded = await loadWorkouts(supabase, userId);
      if (loaded.error) return fail(loaded.error);
      const today = todayYmd(timeZone);
      const upcoming = loaded.workouts
        .filter((w) => w.scheduled_for)
        .map((w) => ({ w, ymd: storedInstantToYmd(w.scheduled_for, timeZone) }))
        .filter((x) => x.ymd && x.ymd >= today)
        .sort((a, b) => String(a.w.scheduled_for).localeCompare(String(b.w.scheduled_for)))
        .slice(0, Math.min(20, Number(a.limit) || 8));
      return ok({
        today,
        workouts: upcoming.map((x) => ({
          ...compactWorkout(x.w),
          local_date: x.ymd,
        })),
      });
    }

    case "get_goals": {
      const { data, error } = await supabase
        .from("goals")
        .select("id, title, type, current_value, target_value, unit, target_date, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) return fail("I couldn't load your goals.");
      return ok({ goals: data || [] });
    }

    case "get_bodyweight": {
      const limit = Math.min(30, Math.max(1, Number(a.history_limit) || 7));
      const { data, error } = await supabase
        .from("bodyweight_logs")
        .select("id, weight, unit, logged_at, notes")
        .eq("user_id", userId)
        .order("logged_at", { ascending: false })
        .limit(limit);
      if (error) return fail("I couldn't load your bodyweight.");
      const rows = data || [];
      return ok({ latest: rows[0] || null, history: rows });
    }

    case "get_measurements": {
      let q = supabase
        .from("measurements")
        .select("id, name, value, unit, date, notes")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(80);
      const { data, error } = await q;
      if (error) return fail("I couldn't load measurements.");
      let rows = data || [];
      if (a.name) {
        const needle = String(a.name).toLowerCase();
        rows = rows.filter((m) => String(m.name || "").toLowerCase().includes(needle));
      }
      return ok({ measurements: rows });
    }

    case "get_nutrition": {
      const date = isYmd(a.date) ? a.date : todayYmd(timeZone);
      const { data: entries, error } = await supabase
        .from("nutrition_entries")
        .select("id, date, food_name, calories, protein, carbs, fat, notes")
        .eq("user_id", userId)
        .eq("date", date)
        .order("created_at", { ascending: true });
      if (error) return fail("I couldn't load nutrition.");
      const list = entries || [];
      const totals = list.reduce(
        (acc, e) => {
          acc.calories += Number(e.calories) || 0;
          acc.protein += Number(e.protein) || 0;
          acc.carbs += Number(e.carbs) || 0;
          acc.fat += Number(e.fat) || 0;
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
      const { data: goals } = await supabase
        .from("nutrition_goals")
        .select("calories_goal, protein_goal, carbs_goal, fat_goal")
        .eq("user_id", userId)
        .maybeSingle();
      return ok({ date, entries: list, totals, goals: goals || null });
    }

    case "estimate_one_rep_max": {
      const estimated = estimateOneRepMax(a.weight, a.reps);
      if (estimated == null) return fail("I need a valid weight and reps.");
      return ok({
        estimated_1rm: estimated,
        input_weight: Number(a.weight),
        input_reps: Number(a.reps),
        unit: displayUnit(a.unit),
        lift_name: a.lift_name || null,
        formula: "epley",
      });
    }

    case "get_fitness_summary": {
      const today = todayYmd(timeZone);
      const [prsLoaded, workoutsLoaded, goalsRes, bwRes, foodRes] = await Promise.all([
        loadPrs(supabase, userId),
        loadWorkouts(supabase, userId),
        supabase
          .from("goals")
          .select("id, title, type, current_value, target_value, unit")
          .eq("user_id", userId),
        supabase
          .from("bodyweight_logs")
          .select("weight, unit, logged_at")
          .eq("user_id", userId)
          .order("logged_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("nutrition_entries")
          .select("calories, protein, carbs, fat")
          .eq("user_id", userId)
          .eq("date", today),
      ]);
      const prs = prsLoaded.prs || [];
      const heaviest = [...prs].sort(
        (x, y) => (toPounds(y.weight, y.unit) || 0) - (toPounds(x.weight, x.unit) || 0)
      )[0];
      const top = [...prs]
        .sort((x, y) => (toPounds(y.weight, y.unit) || 0) - (toPounds(x.weight, x.unit) || 0))
        .slice(0, 3)
        .map(compactPr);
      const upcoming = (workoutsLoaded.workouts || [])
        .filter((w) => w.scheduled_for)
        .map((w) => ({ w, ymd: storedInstantToYmd(w.scheduled_for, timeZone) }))
        .filter((x) => x.ymd && x.ymd >= today)
        .sort((a, b) => String(a.w.scheduled_for).localeCompare(String(b.w.scheduled_for)))[0];
      const foods = foodRes.data || [];
      const calories = foods.reduce((s, e) => s + (Number(e.calories) || 0), 0);
      const protein = foods.reduce((s, e) => s + (Number(e.protein) || 0), 0);
      return ok({
        today,
        latest_bodyweight: bwRes.data || null,
        heaviest_pr: compactPr(heaviest),
        top_prs: top,
        next_workout: upcoming ? { ...compactWorkout(upcoming.w), local_date: upcoming.ymd } : null,
        nutrition_today: { calories, protein, entries: foods.length },
        goals: (goalsRes.data || []).slice(0, 8),
      });
    }

    case "update_profile": {
      const payload = {};
      if (a.bio != null) payload.bio = String(a.bio);
      if (a.display_name != null) payload.display_name = String(a.display_name).trim();
      if (a.handle != null) {
        const handle = String(a.handle).trim().toLowerCase().replace(/^@/, "");
        if (!/^[a-z0-9_]{3,}$/.test(handle)) {
          return fail("Handle must be at least 3 characters of lowercase letters, numbers, or underscores.");
        }
        payload.handle = handle;
      }
      if (a.profile_visibility != null) {
        const vis = String(a.profile_visibility).toLowerCase();
        if (vis !== "public" && vis !== "private") return fail("Visibility must be public or private.");
        payload.profile_visibility = vis;
      }
      if (!Object.keys(payload).length) return fail("Nothing to update.");
      const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
      if (error) return fail("I couldn't save your profile.");
      return ok({
        changed: { domain: "profile", action: "update", id: userId },
        updated: payload,
      });
    }

    case "create_pr": {
      const lift = String(a.lift_name || "").trim();
      const weight = Number(a.weight);
      if (!lift || !Number.isFinite(weight) || weight <= 0) {
        return fail("I need a lift name and a positive weight.");
      }
      const payload = {
        user_id: userId,
        lift_name: lift,
        weight: Math.round(weight),
        reps: a.reps == null || a.reps === "" ? null : Number(a.reps),
        unit: displayUnit(a.unit),
        date: isYmd(a.date) ? a.date : todayYmd(timeZone),
        notes: a.notes ? String(a.notes) : null,
      };
      const { data, error } = await supabase.from("prs").insert(payload).select().maybeSingle();
      if (error) return fail("I couldn't save that PR.");
      return ok({
        pr: compactPr(data),
        changed: { domain: "prs", action: "create", id: data?.id },
      });
    }

    case "update_pr": {
      const loaded = await loadPrs(supabase, userId);
      if (loaded.error) return fail(loaded.error);
      const resolved = resolvePrWrite(loaded.prs, { prId: a.pr_id, liftQuery: a.lift_query });
      if (resolved.ambiguous) {
        return fail("I found more than one matching PR. Which one?", {
          needs_confirmation: true,
          candidates: resolved.candidates,
        });
      }
      if (!resolved.ok) return fail(resolved.error);
      const updates = {};
      if (a.weight != null) updates.weight = Math.round(Number(a.weight));
      if (a.reps != null && a.reps !== "") updates.reps = Number(a.reps);
      if (a.unit != null) updates.unit = displayUnit(a.unit);
      if (isYmd(a.date)) updates.date = a.date;
      if (a.notes != null) updates.notes = String(a.notes);
      if (!Object.keys(updates).length) return fail("Nothing to update on that PR.");
      const { data, error } = await supabase
        .from("prs")
        .update(updates)
        .eq("id", resolved.pr.id)
        .eq("user_id", userId)
        .select()
        .maybeSingle();
      if (error) return fail("I couldn't update that PR.");
      return ok({
        pr: compactPr(data),
        changed: { domain: "prs", action: "update", id: resolved.pr.id },
      });
    }

    case "delete_pr": {
      const loaded = await loadPrs(supabase, userId);
      if (loaded.error) return fail(loaded.error);
      const resolved = resolvePrWrite(loaded.prs, { prId: a.pr_id, liftQuery: a.lift_query });
      if (resolved.ambiguous) {
        return fail("I found more than one matching PR. Which one?", {
          needs_confirmation: true,
          candidates: resolved.candidates,
        });
      }
      if (!resolved.ok) return fail(resolved.error);
      if (a.confirmed !== true) {
        return ok({
          needs_confirmation: true,
          message: `Delete your ${resolved.pr.weight} ${resolved.pr.unit || "lb"} ${resolved.pr.lift_name} PR?`,
          pr: compactPr(resolved.pr),
        });
      }
      const { error } = await supabase
        .from("prs")
        .delete()
        .eq("id", resolved.pr.id)
        .eq("user_id", userId);
      if (error) return fail("I couldn't delete that PR.");
      return ok({
        deleted: compactPr(resolved.pr),
        changed: { domain: "prs", action: "delete", id: resolved.pr.id },
      });
    }

    case "save_estimated_pr": {
      const lift = String(a.lift_name || "").trim();
      if (!lift) return fail("Which lift should I save that estimated PR for?");
      const { error } = await supabase.rpc("save_estimated_pr", {
        p_lift_name: lift,
        p_estimated_weight: Math.round(Number(a.estimated_weight)),
        p_input_weight: Math.round(Number(a.input_weight)),
        p_input_reps: Math.round(Number(a.input_reps)),
        p_unit: displayUnit(a.unit),
      });
      if (error) return fail("I couldn't save that estimated PR.");
      return ok({
        lift_name: lift,
        estimated_weight: Math.round(Number(a.estimated_weight)),
        changed: { domain: "prs", action: "save_estimated", id: null },
      });
    }

    case "create_workout": {
      const name = String(a.name || "Workout").trim() || "Workout";
      const exercises = Array.isArray(a.exercises)
        ? a.exercises.map((ex, i) => makeExercise(ex, i))
        : [];
      const { count } = await supabase
        .from("workouts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      let scheduled_for = null;
      if (isYmd(a.scheduled_date)) {
        scheduled_for = zonedLocalToUtcIso(
          a.scheduled_date,
          a.scheduled_time || "09:00",
          timeZone
        );
      }
      const payload = {
        user_id: userId,
        name,
        position: count || 0,
        exercises,
        scheduled_for,
      };
      const { data, error } = await supabase
        .from("workouts")
        .insert(payload)
        .select()
        .maybeSingle();
      if (error) return fail("I couldn't save that workout.");
      return ok({
        workout: compactWorkout(data),
        changed: { domain: "workouts", action: "create", id: data?.id },
      });
    }

    case "rename_workout":
    case "reschedule_workout":
    case "update_workout": {
      const loaded = await loadWorkouts(supabase, userId);
      if (loaded.error) return fail(loaded.error);
      const found = resolveWorkout(
        loaded.workouts,
        {
          workout_id: a.workout_id,
          name_query: a.name_query,
          scheduled_date: a.from_date || a.scheduled_date_query,
        },
        timeZone
      );
      if (found.error) return fail(found.error);
      if (found.ambiguous) {
        return fail("I found more than one workout. Which one?", {
          needs_confirmation: true,
          candidates: found.candidates,
        });
      }
      const w = found.workout;
      const updates = {};
      if (toolName === "rename_workout" || a.name != null) {
        if (a.name != null) updates.name = String(a.name).trim() || w.name;
      }
      if (toolName === "reschedule_workout" || a.scheduled_date != null) {
        if (a.scheduled_date === "" || a.scheduled_date === null) {
          updates.scheduled_for = null;
        } else if (isYmd(a.scheduled_date)) {
          let hm = a.scheduled_time;
          if (!hm && w.scheduled_for) {
            const d = parseStoredTimestamp(w.scheduled_for);
            hm = d ? hmInTimeZone(d, timeZone) : "09:00";
          }
          updates.scheduled_for = zonedLocalToUtcIso(
            a.scheduled_date,
            hm || "09:00",
            timeZone
          );
        }
      }
      if (Array.isArray(a.exercises)) {
        updates.exercises = a.exercises.map((ex, i) => makeExercise(ex, i));
      }
      if (!Object.keys(updates).length) return fail("Nothing to change on that workout.");
      const { data, error } = await supabase
        .from("workouts")
        .update(updates)
        .eq("id", w.id)
        .eq("user_id", userId)
        .select()
        .maybeSingle();
      if (error) return fail("I couldn't update that workout.");
      return ok({
        workout: compactWorkout(data),
        changed: { domain: "workouts", action: "update", id: w.id },
      });
    }

    case "add_workout_exercise":
    case "update_workout_exercise":
    case "remove_workout_exercise": {
      const loaded = await loadWorkouts(supabase, userId);
      if (loaded.error) return fail(loaded.error);
      const found = resolveWorkout(loaded.workouts, a, timeZone);
      if (found.error) return fail(found.error);
      if (found.ambiguous) {
        return fail("I found more than one workout. Which one?", found);
      }
      const w = found.workout;
      let exercises = Array.isArray(w.exercises) ? [...w.exercises] : [];
      if (toolName === "add_workout_exercise") {
        exercises.push(makeExercise(a, exercises.length));
      } else {
        let idx = -1;
        if (a.exercise_id) idx = exercises.findIndex((ex) => ex.id === a.exercise_id);
        if (idx < 0 && a.exercise_name) {
          const scored = exercises
            .map((ex, i) => ({ i, score: scoreLiftName(a.exercise_name, ex.name) }))
            .filter((x) => x.score >= 62)
            .sort((x, y) => y.score - x.score);
          if (scored.length > 1 && scored[0].score - scored[1].score < 8) {
            return fail("I found more than one matching exercise. Which one?", {
              needs_confirmation: true,
              candidates: scored.slice(0, 5).map((s) => exercises[s.i]),
            });
          }
          idx = scored[0]?.i ?? -1;
        }
        if (idx < 0) return fail("I couldn't find that exercise in the workout.");
        if (toolName === "remove_workout_exercise") {
          exercises.splice(idx, 1);
        } else {
          exercises[idx] = makeExercise({ ...exercises[idx], ...a }, idx);
        }
      }
      const { data, error } = await supabase
        .from("workouts")
        .update({ exercises })
        .eq("id", w.id)
        .eq("user_id", userId)
        .select()
        .maybeSingle();
      if (error) return fail("I couldn't update those exercises.");
      return ok({
        workout: compactWorkout(data),
        changed: { domain: "workouts", action: "update", id: w.id },
      });
    }

    case "delete_workout": {
      const loaded = await loadWorkouts(supabase, userId);
      if (loaded.error) return fail(loaded.error);
      const found = resolveWorkout(loaded.workouts, a, timeZone);
      if (found.error) return fail(found.error);
      if (found.ambiguous) {
        return fail("I found more than one workout. Which one?", {
          needs_confirmation: true,
          candidates: found.candidates,
        });
      }
      const w = found.workout;
      if (a.confirmed !== true) {
        return ok({
          needs_confirmation: true,
          message: `Delete workout "${w.name}"?`,
          workout: compactWorkout(w),
        });
      }
      const { error } = await supabase
        .from("workouts")
        .delete()
        .eq("id", w.id)
        .eq("user_id", userId);
      if (error) return fail("I couldn't delete that workout.");
      return ok({
        deleted: compactWorkout(w),
        changed: { domain: "workouts", action: "delete", id: w.id },
      });
    }

    case "create_goal": {
      const title = String(a.title || "").trim();
      const target = Number(a.target_value);
      if (!title || !Number.isFinite(target)) return fail("I need a title and target value.");
      const payload = {
        user_id: userId,
        title,
        type: a.type || "custom",
        current_value: a.current_value == null ? null : Number(a.current_value),
        target_value: target,
        unit: a.unit || (a.type === "bodyweight" ? "lb" : ""),
        updated_at: new Date().toISOString(),
      };
      if (isYmd(a.target_date)) payload.target_date = a.target_date;
      const { data, error } = await supabase.from("goals").insert(payload).select().maybeSingle();
      if (error) return fail("I couldn't save that goal.");
      return ok({ goal: data, changed: { domain: "goals", action: "create", id: data?.id } });
    }

    case "update_goal": {
      const { data: goals, error: loadErr } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", userId);
      if (loadErr) return fail("I couldn't load your goals.");
      let goal = (goals || []).find((g) => g.id === a.goal_id);
      if (!goal && a.title_query) {
        const q = String(a.title_query).toLowerCase();
        const hits = (goals || []).filter((g) =>
          String(g.title || "").toLowerCase().includes(q)
        );
        if (hits.length > 1) {
          return fail("I found more than one matching goal. Which one?", {
            needs_confirmation: true,
            candidates: hits.slice(0, 5),
          });
        }
        goal = hits[0];
      }
      if (!goal) return fail("I couldn't find that goal.");
      const updates = { updated_at: new Date().toISOString() };
      if (a.title != null) updates.title = String(a.title).trim();
      if (a.type != null) updates.type = a.type;
      if (a.current_value != null) updates.current_value = Number(a.current_value);
      if (a.target_value != null) updates.target_value = Number(a.target_value);
      if (a.unit != null) updates.unit = a.unit;
      if (isYmd(a.target_date)) updates.target_date = a.target_date;
      const { data, error } = await supabase
        .from("goals")
        .update(updates)
        .eq("id", goal.id)
        .eq("user_id", userId)
        .select()
        .maybeSingle();
      if (error) return fail("I couldn't update that goal.");
      return ok({ goal: data, changed: { domain: "goals", action: "update", id: goal.id } });
    }

    case "delete_goal": {
      const { data: goals } = await supabase.from("goals").select("*").eq("user_id", userId);
      let goal = (goals || []).find((g) => g.id === a.goal_id);
      if (!goal && a.title_query) {
        const q = String(a.title_query).toLowerCase();
        const hits = (goals || []).filter((g) =>
          String(g.title || "").toLowerCase().includes(q)
        );
        if (hits.length > 1) {
          return fail("I found more than one matching goal. Which one?", {
            needs_confirmation: true,
            candidates: hits.slice(0, 5),
          });
        }
        goal = hits[0];
      }
      if (!goal) return fail("I couldn't find that goal.");
      if (a.confirmed !== true) {
        return ok({
          needs_confirmation: true,
          message: `Delete goal "${goal.title}"?`,
          goal,
        });
      }
      const { error } = await supabase
        .from("goals")
        .delete()
        .eq("id", goal.id)
        .eq("user_id", userId);
      if (error) return fail("I couldn't delete that goal.");
      return ok({ deleted: goal, changed: { domain: "goals", action: "delete", id: goal.id } });
    }

    case "log_bodyweight": {
      const weight = Number(a.weight);
      if (!Number.isFinite(weight) || weight <= 0) return fail("I need a valid weight.");
      const date = isYmd(a.date) ? a.date : todayYmd(timeZone);
      const logged_at = zonedLocalToUtcIso(date, "12:00", timeZone);
      const payload = {
        user_id: userId,
        weight,
        unit: displayUnit(a.unit) === "kg" ? "kg" : "lbs",
        logged_at,
        notes: a.notes ? String(a.notes) : null,
      };
      const { data, error } = await supabase
        .from("bodyweight_logs")
        .insert(payload)
        .select()
        .maybeSingle();
      if (error) return fail("I couldn't log that bodyweight.");
      return ok({
        log: data,
        changed: { domain: "bodyweight", action: "create", id: data?.id },
      });
    }

    case "update_bodyweight": {
      let id = a.log_id;
      if (!id) {
        const { data: latest } = await supabase
          .from("bodyweight_logs")
          .select("id")
          .eq("user_id", userId)
          .order("logged_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        id = latest?.id;
      }
      if (!id) return fail("No bodyweight log to update.");
      const updates = {};
      if (a.weight != null) updates.weight = Number(a.weight);
      if (a.unit != null) updates.unit = displayUnit(a.unit) === "kg" ? "kg" : "lbs";
      if (isYmd(a.date)) updates.logged_at = zonedLocalToUtcIso(a.date, "12:00", timeZone);
      const { data, error } = await supabase
        .from("bodyweight_logs")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .maybeSingle();
      if (error) return fail("I couldn't update that bodyweight.");
      return ok({
        log: data,
        changed: { domain: "bodyweight", action: "update", id },
      });
    }

    case "log_measurement": {
      const payload = {
        user_id: userId,
        name: String(a.name).trim(),
        value: Number(a.value),
        unit: a.unit || "",
        date: isYmd(a.date) ? a.date : todayYmd(timeZone),
        notes: a.notes ? String(a.notes) : null,
      };
      if (!payload.name || !Number.isFinite(payload.value)) {
        return fail("I need a measurement name and value.");
      }
      const { data, error } = await supabase
        .from("measurements")
        .insert(payload)
        .select()
        .maybeSingle();
      if (error) return fail("I couldn't save that measurement.");
      return ok({
        measurement: data,
        changed: { domain: "measurements", action: "create", id: data?.id },
      });
    }

    case "update_measurement": {
      const updates = {};
      if (a.name != null) updates.name = String(a.name).trim();
      if (a.value != null) updates.value = Number(a.value);
      if (a.unit != null) updates.unit = a.unit;
      if (isYmd(a.date)) updates.date = a.date;
      if (a.notes != null) updates.notes = String(a.notes);
      const { data, error } = await supabase
        .from("measurements")
        .update(updates)
        .eq("id", a.measurement_id)
        .eq("user_id", userId)
        .select()
        .maybeSingle();
      if (error) return fail("I couldn't update that measurement.");
      return ok({
        measurement: data,
        changed: { domain: "measurements", action: "update", id: a.measurement_id },
      });
    }

    case "log_nutrition": {
      const date = isYmd(a.date) ? a.date : todayYmd(timeZone);
      const payload = {
        user_id: userId,
        date,
        food_name: a.food_name ? String(a.food_name) : null,
        calories: Number(a.calories) || 0,
        protein: Number(a.protein) || 0,
        carbs: Number(a.carbs) || 0,
        fat: Number(a.fat) || 0,
        notes: a.notes ? String(a.notes) : null,
      };
      const { data, error } = await supabase
        .from("nutrition_entries")
        .insert(payload)
        .select()
        .maybeSingle();
      if (error) return fail("I couldn't log that food.");
      return ok({
        entry: data,
        changed: { domain: "nutrition", action: "create", id: data?.id },
      });
    }

    case "update_nutrition_goals": {
      const { data: existing } = await supabase
        .from("nutrition_goals")
        .select("calories_goal, protein_goal, carbs_goal, fat_goal, show_progress")
        .eq("user_id", userId)
        .maybeSingle();
      const row = {
        user_id: userId,
        calories_goal: a.calories_goal ?? existing?.calories_goal ?? null,
        protein_goal: a.protein_goal ?? existing?.protein_goal ?? null,
        carbs_goal: a.carbs_goal ?? existing?.carbs_goal ?? null,
        fat_goal: a.fat_goal ?? existing?.fat_goal ?? null,
        show_progress: existing?.show_progress !== false,
      };
      const { data, error } = await supabase
        .from("nutrition_goals")
        .upsert(row, { onConflict: "user_id" })
        .select()
        .maybeSingle();
      if (error) return fail("I couldn't update nutrition goals.");
      return ok({
        goals: data,
        changed: { domain: "nutrition", action: "update_goals", id: userId },
      });
    }

    default:
      return fail("Unknown action.");
  }
}
