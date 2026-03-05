import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = "mailto:support@armpal.net";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {

  if (req.method === "GET") {
    return new Response("send-push alive", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  console.log("send-push: received POST");

  const body = await req.json();

  const userId =
    body?.user_id ??
    body?.to_user_id ??
    body?.receiver_id ??
    null;

  if (!userId) {
    return new Response(JSON.stringify({ ok: false, reason: "missing_user_id" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  const title = body?.title ?? "ArmPal";
  const message = body?.body ?? "New notification";
  const link = body?.link ?? "/";

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint,keys")
    .eq("user_id", userId);

  console.log("subscriptions:", subs?.length ?? 0);

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  let sent = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys
        },
        JSON.stringify({
          title: "ArmPal",
          body: message,
          link: link || "/"
        })
      );
      sent++;
    } catch (e) {
      console.error("push failed", e);
    }
  }

  console.log("sent:", sent);

  return new Response(JSON.stringify({ ok: true, sent }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });

});
