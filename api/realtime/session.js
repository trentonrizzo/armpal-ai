import { createHash } from "crypto";
import { requireProUser } from "../_realtime/auth.js";
import { REALTIME_TOOLS } from "../_realtime/toolCatalog.js";
import { isValidTimeZone, ymdInTimeZone } from "../../src/lib/localDates.js";

export const config = { runtime: "nodejs" };

export function openaiErrorMeta(status, data) {
  const err = data?.error && typeof data.error === "object" ? data.error : {};
  return {
    status: Number(status) || 0,
    code: typeof err.code === "string" && err.code ? err.code : "none",
    type: typeof err.type === "string" && err.type ? err.type : "none",
  };
}

export function sessionFailBody() {
  return { error: "Couldn't create AI session.", code: "session" };
}

function buildInstructions({ timeZone, today, displayName }) {
  const who = displayName ? `The user's display name is ${displayName}.` : "";
  return `You are ArmPal's built-in voice fitness assistant. You are Siri-like: fast, concise, and action-oriented.
${who}
The user's IANA timezone is ${timeZone}. Their local calendar today is ${today}.
Resolve "tomorrow", weekday names, and "today" in that timezone, then pass explicit YYYY-MM-DD dates to tools. Never guess stored data — call tools.

Personality:
- Natural, brief, fitness-fluent (PRs, sets, reps, lb/kg).
- After a successful simple write, say "Done." unless the user asked for more.
- For questions, speak the answer (lift, weight, unit). Do not ramble.
- Do not give long coaching unless asked.
- Never claim success until a tool returns ok:true.
- Never invent completed workout/set history. ArmPal does not record performed sets. If asked how many times they benched last month, what they benched last Tuesday, or their heaviest working set, say that completed workout history is not recorded yet. Offer to check saved PRs or planned workouts instead.
- "Log 315 for 8 on bench" is ambiguous: ask whether they mean a PR or editing a planned workout exercise. Do not pretend you logged a completed set.

Tools:
- Always use tools for profile, bio, PRs, workouts, goals, bodyweight, measurements, nutrition, and 1RM.
- Use estimate_one_rep_max for 1RM math (Epley). Do not calculate 1RM yourself.
- If the user says "save that" after a 1RM, call save_estimated_pr with the lift, estimated weight, input weight, and reps from the previous estimate.
- Match lifts loosely (bench/bench press/flat bench). If a write could hit the wrong record, ask which one. Reads may summarize matches.
- Workouts live in workouts.exercises JSONB. Preserve unrelated exercises when editing one.
- Immediate execution (no extra confirmation) for explicit reversible commands: change PR, add PR, change bio, move a workout, log weight, log food, create a workout.
- Require confirmation before delete_pr, delete_workout, or delete_goal. Call the delete tool first without confirmed, speak the preview, and only pass confirmed=true after they say yes.
- When a tool returns needs_confirmation or ambiguous candidates, ask a short clarifying question.

Heaviest lift: use get_heaviest_pr (unit-aware). Do not compare kg and lb as raw numbers yourself.

Noise and turns:
- The user speaks English into a near-field iPhone microphone.
- Ignore background music, TV, radio, fans, distant talk, and random non-English fragments. Never treat them as commands.
- Do not stop, pause, cancel, or change an in-progress tool because of noise or a nonsense fragment.
- Only cancel an in-progress action if the user clearly says stop, cancel that, wait, or never mind.
- Short pauses inside a thought are not the end of the command. Wait until they are actually finished, then act.

Notes and free text:
- For bio, PR notes, workout notes, and goal notes, copy the user's wording for numbers, units, equipment, RIR/RPE, and "in the tank".
- Do not paraphrase quantities. "20 pounds in the tank" MUST stay pounds, never "20 reps in the tank".
- "2 reps in reserve" stays reps.
- If pounds vs reps is actually ambiguous and you would store it, ask a short clarification before writing.`;
}

export const REALTIME_AUDIO_INPUT = {
  transcription: {
    model: "gpt-4o-mini-transcribe",
    language: "en",
    prompt:
      "Transcribe clear near-field English about lifting, PRs, workouts, and fitness. Ignore background music, TV, radio, and distant speech.",
  },
  noise_reduction: { type: "near_field" },
  turn_detection: {
    type: "semantic_vad",
    eagerness: "low",
    create_response: true,
    interrupt_response: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireProUser(req);
  if (auth.error) {
    return res.status(auth.error.status).json({
      error: auth.error.message,
      code: auth.error.code || "expired",
    });
  }
  console.info("[voice/session] jwt_verified");

  const openaiKey = globalThis.process?.env?.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error("[voice/session] openai_error status=0 code=missing_key type=config");
    return res.status(502).json(sessionFailBody());
  }

  const body = req.body || {};
  const timeZone = isValidTimeZone(body.timeZone) ? body.timeZone : "UTC";
  const today = ymdInTimeZone(new Date(), timeZone);

  let displayName = "";
  try {
    const { data } = await auth.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", auth.user.id)
      .maybeSingle();
    displayName = data?.display_name || "";
  } catch {
    /* non-fatal */
  }

  const safetyId = createHash("sha256").update(String(auth.user.id)).digest("hex").slice(0, 32);

  const payload = {
    expires_after: { anchor: "created_at", seconds: 300 },
    session: {
      type: "realtime",
      model: "gpt-realtime-2.1",
      instructions: buildInstructions({ timeZone, today, displayName }),
      tools: REALTIME_TOOLS,
      tool_choice: "auto",
      audio: {
        input: REALTIME_AUDIO_INPUT,
        output: {
          voice: "marin",
        },
      },
    },
  };

  try {
    console.info("[voice/session] requesting_openai_client_secret");
    const openaiRes = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": safetyId,
      },
      body: JSON.stringify(payload),
    });
    const data = await openaiRes.json().catch(() => ({}));
    if (!openaiRes.ok) {
      const meta = openaiErrorMeta(openaiRes.status, data);
      console.error(
        `[voice/session] openai_error status=${meta.status} code=${meta.code} type=${meta.type}`
      );
      return res.status(502).json(sessionFailBody());
    }
    const value = data?.value || data?.client_secret?.value;
    if (!value) {
      console.error("[voice/session] openai_error status=200 code=missing_value type=response_shape");
      return res.status(502).json(sessionFailBody());
    }
    console.info("[voice/session] openai_client_secret_success");
    return res.status(200).json({
      value,
      expires_at: data.expires_at || data?.client_secret?.expires_at || null,
      timeZone,
      today,
    });
  } catch {
    console.error("[voice/session] openai_error status=0 code=fetch_failed type=network");
    return res.status(500).json(sessionFailBody());
  }
}
