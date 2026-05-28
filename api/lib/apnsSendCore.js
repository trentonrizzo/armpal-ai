import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import http2 from "node:http2";

const LOG = "[ArmPal.Push]";

function normalizePrivateKey(key) {
  return String(key || "").replace(/\\n/g, "\n").trim();
}

function createApnsJwt(keyId, teamId, privateKeyPem) {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })
  ).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign("SHA256");
  sign.update(signingInput);
  sign.end();
  const signature = sign.sign({ key: privateKeyPem, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${Buffer.from(signature).toString("base64url")}`;
}

function sendApnsNotification({ deviceToken, jwt, topic, payload, useSandbox }) {
  const host = useSandbox ? "api.sandbox.push.apple.com" : "api.push.apple.com";

  return new Promise((resolve, reject) => {
    const client = http2.connect(`https://${host}`);

    client.on("error", (err) => {
      try {
        client.close();
      } catch {
        /* ignore */
      }
      reject(err);
    });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });

    let responseBody = "";
    let statusCode = 0;

    req.setEncoding("utf8");

    req.on("response", (headers) => {
      statusCode = Number(headers[":status"] || 0);
      req.on("data", (chunk) => {
        responseBody += chunk;
      });
      req.on("end", () => {
        try {
          client.close();
        } catch {
          /* ignore */
        }
        resolve({ status: statusCode, body: responseBody });
      });
    });

    req.on("error", (err) => {
      try {
        client.close();
      } catch {
        /* ignore */
      }
      reject(err);
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

function getApnsEnv() {
  return {
    APNS_KEY_ID: process.env.APNS_KEY_ID,
    APNS_TEAM_ID: process.env.APNS_TEAM_ID,
    APNS_BUNDLE_ID: process.env.APNS_BUNDLE_ID,
    APNS_PRIVATE_KEY: process.env.APNS_PRIVATE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    APNS_USE_SANDBOX: process.env.APNS_USE_SANDBOX === "true",
  };
}

/**
 * Send APNs alert to all enabled iOS tokens for a user (server-side only).
 */
export async function sendApnsToUser({ userId, title, body, data = {} }) {
  const env = getApnsEnv();

  if (
    !env.APNS_KEY_ID ||
    !env.APNS_TEAM_ID ||
    !env.APNS_BUNDLE_ID ||
    !env.APNS_PRIVATE_KEY ||
    !env.SUPABASE_URL ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.warn(LOG, "apns error", { reason: "not_configured" });
    return { ok: false, error: "APNs not configured", sent: 0, failed: 0 };
  }

  if (!userId) {
    return { ok: false, error: "Missing userId", sent: 0, failed: 0 };
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  console.log(LOG, "Supabase token lookup", { userId, table: "push_tokens" });

  const { data: tokenRows, error: tokenErr } = await supabase
    .from("push_tokens")
    .select("id, token")
    .eq("user_id", userId)
    .eq("enabled", true)
    .eq("platform", "ios");

  if (tokenErr) {
    console.warn(LOG, "apns error", { reason: "token_lookup_failed", message: tokenErr.message });
    return { ok: false, error: tokenErr.message, sent: 0, failed: 0 };
  }

  const tokenCount = tokenRows?.length || 0;
  console.log(LOG, "tokens found", {
    userId,
    tokenCount,
    tokenIds: (tokenRows || []).map((r) => r.id),
  });

  if (!tokenCount) {
    console.warn(LOG, "push failed", { reason: "no_tokens", userId });
    return { ok: true, sent: 0, failed: 0, reason: "no_tokens", tokenCount: 0 };
  }

  const jwt = createApnsJwt(
    env.APNS_KEY_ID,
    env.APNS_TEAM_ID,
    normalizePrivateKey(env.APNS_PRIVATE_KEY)
  );

  const apnsPayload = {
    aps: {
      alert: {
        title: title || "ArmPal",
        body: body || "",
      },
      sound: "default",
    },
    ...data,
  };

  const useSandbox = env.APNS_USE_SANDBOX;
  console.log(LOG, "apns request start", {
    userId,
    tokenCount,
    topic: env.APNS_BUNDLE_ID,
    sandbox: useSandbox,
    title,
    bodyPreview: String(body || "").slice(0, 120),
  });

  let sent = 0;
  let failed = 0;
  const results = [];

  for (const row of tokenRows) {
    const tokenPreview = `${String(row.token).slice(0, 8)}…${String(row.token).slice(-8)}`;
    try {
      const result = await sendApnsNotification({
        deviceToken: row.token,
        jwt,
        topic: env.APNS_BUNDLE_ID,
        payload: apnsPayload,
        useSandbox,
      });

      console.log(LOG, "APNs HTTP status", {
        tokenId: row.id,
        tokenPreview,
        status: result.status,
        body: result.body || "",
      });

      if (result.status === 200) {
        sent += 1;
        results.push({ ok: true, tokenId: row.id });
        console.log(LOG, "apns success", { tokenId: row.id, tokenPreview });
      } else {
        failed += 1;
        results.push({
          ok: false,
          tokenId: row.id,
          status: result.status,
          body: result.body,
        });
        console.warn(LOG, "apns error", {
          tokenId: row.id,
          tokenPreview,
          status: result.status,
          body: result.body,
        });

        if (result.status === 410 || result.status === 400) {
          await supabase
            .from("push_tokens")
            .update({ enabled: false, updated_at: new Date().toISOString() })
            .eq("id", row.id);
        }
      }
    } catch (err) {
      failed += 1;
      results.push({ ok: false, tokenId: row.id, error: err?.message || String(err) });
      console.warn(LOG, "apns error", {
        tokenId: row.id,
        tokenPreview,
        error: err?.message || String(err),
      });
    }
  }

  if (sent > 0) {
    console.log(LOG, "push sent", { userId, sent, failed, tokenCount });
  } else {
    console.warn(LOG, "push failed", { userId, sent, failed, tokenCount, results });
  }

  return { ok: sent > 0 || failed === 0, sent, failed, tokenCount, results };
}
