// supabase/functions/send-push/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function sendPush(subscription: any, payload: any) {
  const encoder = new TextEncoder();
  const body = encoder.encode(JSON.stringify(payload));

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    urlBase64ToUint8Array(subscription.p256dh),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const authSecret = urlBase64ToUint8Array(subscription.auth);

  await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      TTL: "2419200",
      "Content-Type": "application/json",
    },
    body,
  });
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { receiver_id, title, body } = await req.json();

    if (!receiver_id || !body) {
      return new Response("Missing fields", { status: 400 });
    }

    // Get push subscriptions
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

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response("Push failed", { status: 500 });
  }
});
