import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@armpal.net";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Core push logic (shared by realtime listener and HTTP fallback) ──

interface NotificationRecord {
  user_id: string;
  title?: string;
  body?: string;
  link?: string;
}

async function handleNotification(record: NotificationRecord) {
  const { user_id, title, body, link } = record;
  if (!user_id) return { ok: false, reason: "no_user_id" };

  const { data: subscriptions, error: subErr } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, keys")
    .eq("user_id", user_id);

  if (subErr) {
    console.error("Failed to fetch subscriptions:", subErr);
    return { ok: false, reason: "fetch_error" };
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { ok: true, sent: 0, reason: "no_subscriptions" };
  }

  const pushPayload = JSON.stringify({
    title: title || "ArmPal",
    body: body || "New notification",
    link: link || "/",
  });

  let sent = 0;
  const staleIds: string[] = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, pushPayload);
      sent++;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        staleIds.push(sub.id);
      } else {
        console.error(`Push failed for ${sub.endpoint}:`, err);
      }
    }
  }

  if (staleIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", staleIds);
  }

  return { ok: true, sent, cleaned: staleIds.length };
}

// ── Realtime subscription: listen for INSERT on public.notifications ──

admin
  .channel("push-notifications-listener")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "notifications" },
    async (payload) => {
      const row = payload.new as NotificationRecord;
      if (!row.user_id) return; // skip global notifications
      console.log("Realtime INSERT on notifications:", row.user_id);
      const result = await handleNotification(row);
      console.log("Push result:", result);
    }
  )
  .subscribe((status) => {
    console.log("Realtime subscription status:", status);
  });

// ── HTTP handler: health check + manual trigger fallback ──

const ALLOWED_ORIGINS = [
  "https://www.armpal.net",
  "https://armpal.net",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  // OPTIONS — CORS preflight (must be handled first)
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors });
  }

  // HEAD — keep-alive probe
  if (req.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // GET — health check / cron keep-alive
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", alive: true }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // POST — manual trigger fallback
  if (req.method === "POST") {
    try {
      const payload = await req.json();
      const record = payload.record ?? payload;
      const result = await handleNotification(record);
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("send-push POST error:", err);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
