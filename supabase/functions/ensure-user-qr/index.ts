// ArmPal: ensure permanent user QR code exists (backend-safe).
// Encodes: https://www.armpal.net/u/@{handle}
// Runs idempotently: does nothing if qr_created and qr_code_url already set.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROFILE_URL_BASE = "https://www.armpal.net/u/@";
const QR_BUCKET = "qr-codes";
const QR_SIZE = 400;

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "Invalid or missing user" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("handle, username, qr_created, qr_code_url")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ ok: false, reason: "profile_not_found" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (profile.qr_created === true && profile.qr_code_url) {
      return new Response(
        JSON.stringify({ ok: true, already: true, url: profile.qr_code_url }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const handle = profile.handle ?? profile.username ?? null;
    if (!handle || typeof handle !== "string" || !handle.trim()) {
      return new Response(
        JSON.stringify({ ok: false, reason: "no_handle" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const profileUrl = PROFILE_URL_BASE + encodeURIComponent(handle.trim());
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=${encodeURIComponent(profileUrl)}`;

    const qrRes = await fetch(qrImageUrl);
    if (!qrRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, reason: "qr_generation_failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    const qrBlob = await qrRes.arrayBuffer();
    const path = `${user.id}.png`;

    const { data: buckets } = await admin.storage.listBuckets();
    const hasBucket = buckets?.some((b) => b.name === QR_BUCKET) ?? false;
    if (!hasBucket) {
      await admin.storage.createBucket(QR_BUCKET, { public: true });
    }

    const { error: uploadError } = await admin.storage
      .from(QR_BUCKET)
      .upload(path, qrBlob, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("QR upload error:", uploadError);
      return new Response(
        JSON.stringify({ ok: false, reason: "upload_failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const {
      data: { publicUrl },
    } = admin.storage.from(QR_BUCKET).getPublicUrl(path);

    const { error: updateError } = await admin
      .from("profiles")
      .update({
        qr_code_url: publicUrl,
        qr_created: true,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Profile update error:", updateError);
      return new Response(
        JSON.stringify({ ok: false, reason: "update_failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, url: publicUrl }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ensure-user-qr error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
