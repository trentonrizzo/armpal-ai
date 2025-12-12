// supabase/functions/send-push/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sendPush(subscription: any, payload: any) {
  await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      TTL: "2419200",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { receiver_id, title, body } = await req.json();

    if (!receiver_id || !body) {
      return new Response(
        JSON.stringify({ error: "receiver_id and body are required" }),
        { status: 400 }
      );
    }

    // Fetch push subscriptions for receiver
    const subRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${receiver_id}`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );

    const subs = await subRes.json();

    for (const sub of subs) {
      await sendPush(sub, {
        title: title || "New message",
        body,
      });
    }

    return new Response(
      JSON.stringify({ success: true, sent: subs.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response("Push failed", { status: 500 });
  }
});
