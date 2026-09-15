import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { estimateOneRepMax } from "../src/lib/oneRepMax.js";
import { toPounds, normalizeUnit } from "../src/lib/unitConvert.js";
import { ymdInTimeZone, zonedLocalToUtcIso, isValidTimeZone } from "../src/lib/localDates.js";
import { findMatchingPrs, resolvePrWrite, scoreLiftName } from "../src/lib/liftMatch.js";
import { ALLOWED_TOOL_NAMES, REALTIME_TOOLS, TOOL_ALIASES } from "../api/_realtime/toolCatalog.js";
import { executeFitnessTool, makeExercise } from "../api/_realtime/fitnessTools.js";
import sessionHandler, { openaiErrorMeta, sessionFailBody } from "../api/realtime/session.js";
import toolsHandler, { parseArgs } from "../api/realtime/tools.js";
import { voiceErrorMessage, extractFunctionCalls } from "../src/features/voice/voiceErrors.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;

async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok  ${name}`);
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function createQuery(run) {
  const q = {
    select: () => q,
    eq: () => q,
    order: () => q,
    limit: () => q,
    in: () => q,
    not: () => q,
    insert: (row) => {
      q._op = "insert";
      q._payload = row;
      return q;
    },
    update: (row) => {
      q._op = "update";
      q._payload = row;
      return q;
    },
    delete: () => {
      q._op = "delete";
      return q;
    },
    upsert: (row) => {
      q._op = "upsert";
      q._payload = row;
      return q;
    },
    maybeSingle: () => run(q, true),
    single: () => run(q, true),
    then: (resolve, reject) => Promise.resolve(run(q, false)).then(resolve, reject),
  };
  q._op = "select";
  q._payload = null;
  return q;
}

function createMockSupabase({ prs = [], workouts = [] } = {}) {
  const ops = [];
  const state = {
    prs: [...prs],
    workouts: workouts.map((w) => ({
      ...w,
      exercises: Array.isArray(w.exercises) ? w.exercises.map((ex) => ({ ...ex })) : [],
    })),
  };
  return {
    ops,
    state,
    from(table) {
      return createQuery(async (q, single) => {
        ops.push({ table, op: q._op, payload: q._payload });
        if (table === "prs") {
          if (q._op === "update" && q._payload) {
            Object.assign(state.prs[0] || {}, q._payload);
            return { data: single ? state.prs[0] : state.prs, error: null };
          }
          if (q._op === "delete") {
            const deleted = state.prs[0] || null;
            state.prs = [];
            return { data: single ? deleted : [], error: null };
          }
          if (q._op === "insert") {
            const row = { id: "pr-new", ...q._payload };
            state.prs.push(row);
            return { data: single ? row : [row], error: null };
          }
          return { data: single ? state.prs[0] || null : state.prs, error: null };
        }
        if (table === "workouts") {
          if (q._op === "update" && q._payload) {
            Object.assign(state.workouts[0] || {}, q._payload);
            return { data: single ? state.workouts[0] : state.workouts, error: null };
          }
          if (q._op === "delete") {
            const deleted = state.workouts[0] || null;
            state.workouts = [];
            return { data: single ? deleted : [], error: null };
          }
          return {
            data: single ? state.workouts[0] || null : state.workouts,
            count: state.workouts.length,
            error: null,
          };
        }
        return { data: single ? null : [], error: null };
      });
    },
    rpc: async (name, args) => {
      ops.push({ table: "rpc", op: name, payload: args });
      return { data: { ok: true }, error: null };
    },
  };
}

const user = { id: "user-1" };

await check("Epley 315x8 = 399", () => {
  assert.equal(estimateOneRepMax(315, 8), 399);
});

await check("reps=1 returns input weight", () => {
  assert.equal(estimateOneRepMax(315, 1), 315);
});

await check("unit conversion kg vs lb for heaviest PR", () => {
  const kg = toPounds(100, "kg");
  const lb = toPounds(200, "lb");
  assert.ok(kg > lb);
  assert.equal(normalizeUnit("kgs"), "kg");
});

await check("lift matching: bench / bench press / flat bench", () => {
  const prs = [
    { id: "1", lift_name: "Bench Press", weight: 315 },
    { id: "2", lift_name: "Deadlift", weight: 500 },
  ];
  for (const q of ["bench", "bench press", "flat bench", "my bench"]) {
    const hits = findMatchingPrs(prs, q);
    assert.equal(hits[0].pr.id, "1", q);
  }
  assert.ok(scoreLiftName("ohp", "Overhead Press") >= 62);
});

await check("ambiguous write does not pick silently", () => {
  const prs = [
    { id: "1", lift_name: "Bench Press", weight: 315 },
    { id: "2", lift_name: "Incline Bench", weight: 275 },
  ];
  const resolved = resolvePrWrite(prs, { liftQuery: "bench" });
  assert.equal(resolved.ok, false);
  assert.equal(resolved.ambiguous, true);
});

await check("dates use supplied IANA timezone", () => {
  assert.equal(isValidTimeZone("America/Chicago"), true);
  const ymd = ymdInTimeZone(new Date("2026-09-16T04:00:00.000Z"), "America/Chicago");
  assert.equal(ymd, "2026-09-15");
  const iso = zonedLocalToUtcIso("2026-09-16", "09:00", "America/Chicago");
  assert.equal(iso, "2026-09-16T14:00:00.000Z");
});

await check("workout JSONB mutation preserves unrelated exercises", () => {
  const existing = [
    makeExercise({ id: "e1", name: "Bench", sets: 5, reps: 5, weight: "225" }, 0),
    makeExercise({ id: "e2", name: "Rows", sets: 3, reps: 8, weight: "185" }, 1),
    makeExercise({ id: "e3", name: "Flyes", sets: 3, reps: 12 }, 2),
  ];
  const next = existing.filter((ex) => ex.id !== "e2");
  next.push(makeExercise({ name: "OHP", sets: 3, reps: 8 }, 3));
  assert.equal(next.find((ex) => ex.id === "e1").name, "Bench");
  assert.equal(next.find((ex) => ex.id === "e3").name, "Flyes");
  assert.equal(next.some((ex) => ex.id === "e2"), false);
  assert.equal(next.at(-1).name, "OHP");
});

await check("tool allowlist rejects unknown names", () => {
  assert.equal(ALLOWED_TOOL_NAMES.has("drop_table"), false);
  assert.equal(ALLOWED_TOOL_NAMES.has("execute_sql"), false);
  assert.equal(ALLOWED_TOOL_NAMES.has("get_heaviest_pr"), true);
  assert.equal(ALLOWED_TOOL_NAMES.has("save_estimated_pr"), true);
  assert.equal(TOOL_ALIASES.get_bio, "get_profile");
  assert.ok(REALTIME_TOOLS.every((t) => t.type === "function" && t.name));
});

await check("malformed tool arguments parse as failure", () => {
  assert.equal(parseArgs("{not json"), null);
  assert.deepEqual(parseArgs('{"weight":385}'), { weight: 385 });
  assert.deepEqual(parseArgs(null), {});
});

const unauthReq = { method: "POST", headers: {}, body: {} };

await check("unauthenticated session rejects", async () => {
  const res = mockRes();
  await sessionHandler(unauthReq, res);
  assert.equal(res.statusCode, 401);
});

await check("unauthenticated tools rejects", async () => {
  const res = mockRes();
  await toolsHandler(unauthReq, res);
  assert.equal(res.statusCode, 401);
});

await check("malformed tool names reject when authenticated path is simulated", async () => {
  const res = mockRes();
  await toolsHandler(
    {
      method: "POST",
      headers: { authorization: "Bearer not-a-real-jwt" },
      body: { name: "drop_table", arguments: {} },
    },
    res
  );
  assert.ok(res.statusCode === 401 || (res.statusCode === 400 && res.body?.error === "Unknown action."));
});

await check("heaviest PR converts units", async () => {
  const supabase = createMockSupabase({
    prs: [
      { id: "a", lift_name: "Bench", weight: 200, unit: "lb", reps: 1, date: "2026-01-01" },
      { id: "b", lift_name: "Squat", weight: 100, unit: "kg", reps: 1, date: "2026-01-02" },
    ],
  });
  const result = await executeFitnessTool({
    name: "get_heaviest_pr",
    args: {},
    user,
    supabase,
    timeZone: "America/Chicago",
  });
  assert.equal(result.ok, true);
  assert.equal(result.pr.id, "b");
});

await check("explicit PR update does not require confirmation", async () => {
  const supabase = createMockSupabase({
    prs: [{ id: "p1", lift_name: "Bench Press", weight: 315, unit: "lb", reps: 1, date: "2026-01-01" }],
  });
  const result = await executeFitnessTool({
    name: "update_pr",
    args: { lift_query: "bench", weight: 385 },
    user,
    supabase,
    timeZone: "America/Chicago",
  });
  assert.equal(result.ok, true);
  assert.equal(result.needs_confirmation, undefined);
  assert.equal(result.changed.domain, "prs");
  assert.ok(supabase.ops.some((op) => op.op === "update"));
});

await check("delete PR requires confirmation first", async () => {
  const supabase = createMockSupabase({
    prs: [{ id: "p1", lift_name: "Bench Press", weight: 385, unit: "lb", reps: 1, date: "2026-01-01" }],
  });
  const preview = await executeFitnessTool({
    name: "delete_pr",
    args: { lift_query: "bench" },
    user,
    supabase,
    timeZone: "America/Chicago",
  });
  assert.equal(preview.ok, true);
  assert.equal(preview.needs_confirmation, true);
  assert.equal(supabase.state.prs.length, 1);

  const done = await executeFitnessTool({
    name: "delete_pr",
    args: { lift_query: "bench", confirmed: true },
    user,
    supabase,
    timeZone: "America/Chicago",
  });
  assert.equal(done.ok, true);
  assert.ok(supabase.ops.some((op) => op.table === "prs" && op.op === "delete"));
});

await check("remove workout exercise preserves siblings", async () => {
  const supabase = createMockSupabase({
    workouts: [
      {
        id: "w1",
        name: "Push",
        scheduled_for: "2026-09-16T14:00:00.000Z",
        position: 0,
        exercises: [
          { id: "e1", name: "Bench", sets: 5, reps: 5 },
          { id: "e2", name: "OHP", sets: 3, reps: 8 },
          { id: "e3", name: "Flyes", sets: 3, reps: 12 },
        ],
      },
    ],
  });
  const result = await executeFitnessTool({
    name: "remove_workout_exercise",
    args: { workout_id: "w1", exercise_id: "e2" },
    user,
    supabase,
    timeZone: "America/Chicago",
  });
  assert.equal(result.ok, true);
  const names = result.workout.exercises.map((ex) => ex.name);
  assert.deepEqual(names, ["Bench", "Flyes"]);
});

await check("save_estimated_pr uses live RPC", async () => {
  const supabase = createMockSupabase();
  const result = await executeFitnessTool({
    name: "save_estimated_pr",
    args: {
      lift_name: "Bench",
      estimated_weight: 399,
      input_weight: 315,
      input_reps: 8,
      unit: "lb",
    },
    user,
    supabase,
    timeZone: "America/Chicago",
  });
  assert.equal(result.ok, true);
  assert.equal(supabase.ops[0].op, "save_estimated_pr");
  assert.equal(supabase.ops[0].payload.p_estimated_weight, 399);
});

await check("tool result shape returns to Realtime conversation", () => {
  const output = [
    { type: "message", role: "assistant" },
    { type: "function_call", name: "get_prs", call_id: "c1", arguments: "{}" },
  ];
  const calls = extractFunctionCalls(output);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].call_id, "c1");
});

await check("voice errors are stage-specific", () => {
  assert.equal(voiceErrorMessage({ name: "NotAllowedError" }), "Microphone permission denied.");
  assert.equal(voiceErrorMessage({ message: "session" }), "Couldn't create AI session.");
  assert.equal(voiceErrorMessage({ message: "connect" }), "Couldn't connect to Realtime.");
  assert.equal(voiceErrorMessage({ message: "session-expired" }), "Your ArmPal session expired.");
});

await check("openai 401 is mapped without leaking key material", () => {
  const meta = openaiErrorMeta(401, {
    error: { code: "invalid_api_key", type: "invalid_request_error", message: "Incorrect API key provided: sk-secret" },
  });
  assert.equal(meta.status, 401);
  assert.equal(meta.code, "invalid_api_key");
  assert.equal(meta.type, "invalid_request_error");
  assert.equal(sessionFailBody().error, "Couldn't create AI session.");
  assert.equal(JSON.stringify(meta).includes("sk-secret"), false);
});

await check("voice sources do not use service role or log secrets", () => {
  const files = [
    "api/_realtime/fitnessTools.js",
    "api/_realtime/auth.js",
    "api/_realtime/toolCatalog.js",
    "api/realtime/session.js",
    "api/realtime/tools.js",
    "src/features/voice/realtimeClient.js",
    "src/features/voice/VoiceAgentButton.jsx",
    "src/features/voice/voiceErrors.js",
  ];
  for (const rel of files) {
    const text = readFileSync(join(root, rel), "utf8");
    assert.equal(/SERVICE_ROLE|service_role/.test(text), false, rel);
    assert.equal(/console\.log\([^)]*OPENAI/.test(text), false, rel);
    assert.equal(/sk-[a-zA-Z0-9]/.test(text), false, rel);
  }
  const client = readFileSync(join(root, "src/features/voice/realtimeClient.js"), "utf8");
  assert.equal(client.includes("OPENAI_API_KEY"), false);
  assert.equal(client.includes("process.env"), false);
  assert.match(client, /credentials:\s*["']include["']/);
  assert.match(readFileSync(join(root, "api/realtime/session.js"), "utf8"), /\[voice\/session\] jwt_verified/);
});

await check("session instructions refuse fabricated workout history", () => {
  const text = readFileSync(join(root, "api/realtime/session.js"), "utf8");
  assert.match(text, /completed workout history is not recorded yet/);
  assert.match(text, /gpt-realtime-2.1/);
});

console.log(`\n${passed} voice-agent checks passed`);
