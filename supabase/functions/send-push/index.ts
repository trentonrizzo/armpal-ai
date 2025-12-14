import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const ONESIGNAL_APP_ID = "edd3f271-1b21-4f0b-ba32-8fafd9132f10";
const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { user_id, title, message } = await req.json();

    if (!user_id || !message) {
      return new Response(
        JSON.stringify({ error: "user_id and message required" }),
        { status: 400 }
      );
    }

    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: [user_id],
        headings: { en: title || "ArmPal" },
        contents: { en: message },
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response("Push failed", { status: 500 });
  }
});
