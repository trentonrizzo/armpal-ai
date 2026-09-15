import { requireUser } from "../lib/realtimeAuth.js";
import { ALLOWED_TOOL_NAMES } from "../lib/toolCatalog.js";
import { executeFitnessTool } from "../lib/fitnessTools.js";
import { isValidTimeZone } from "../../src/lib/localDates.js";

export const config = { runtime: "nodejs" };

export function parseArgs(raw) {
  if (raw == null) return {};
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return null;
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireUser(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const body = req.body || {};
  const toolName = typeof body.name === "string" ? body.name.trim() : "";
  if (!toolName || !ALLOWED_TOOL_NAMES.has(toolName)) {
    return res.status(400).json({ ok: false, error: "Unknown action." });
  }

  const args = parseArgs(body.arguments ?? body.args ?? {});
  if (args == null) {
    return res.status(400).json({ ok: false, error: "Invalid arguments." });
  }

  const timeZone = isValidTimeZone(body.timeZone) ? body.timeZone : "UTC";

  try {
    const result = await executeFitnessTool({
      name: toolName,
      args,
      user: auth.user,
      supabase: auth.supabase,
      timeZone,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error("[ArmPal.Voice] tool error", toolName, err?.message);
    return res.status(500).json({ ok: false, error: "I couldn't complete that." });
  }
}
