import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import http2 from "node:http2";

const API_LOG = "[ArmPal.Push.API]";

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
export async function sendApnsToUser({ userId, title, body, data = {}, logPrefix }) {
  const LOG = logPrefix || API_LOG;
  console.log(LOG, "ROUTE HIT", { handler: "sendApnsToUser", userId });

  const requestBody = { userId, title, body, data };
  console.log(LOG, "BODY", requestBody);

  if (!userId) {
    console.error(LOG, "APNs failure", { reason: "missing_userId" });
    return { ok: false, error: "Missing userId", sent: 0, failed: 0 };
  }

  if (!title && !body) {
    console.error(LOG, "APNs failure", { reason: "missing_title_or_body" });
    return { ok: false, error: "Missing title/body", sent: 0, failed: 0 };
  }

  const env = getApnsEnv();

  if (
    !env.APNS_KEY_ID ||
    !env.APNS_TEAM_ID ||
    !env.APNS_BUNDLE_ID ||
    !env.APNS_PRIVATE_KEY ||
    !env.SUPABASE_URL ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.error(LOG, "APNs failure", { reason: "apns_not_configured" });
    return { ok: false, error: "APNs not configured", sent: 0, failed: 0 };
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: tokens, error: tokenErr } = await supabase
    .from("push_tokens")
    .select("id, token, enabled, platform, user_id")
    .eq("user_id", userId)
    .eq("enabled", true)
    .eq("platform", "ios");

  const tokenCount = tokens?.length || 0;

  console.log(LOG, "recipient resolved", { recipientId: userId });

  console.log(LOG, "TOKENS QUERY RESULT", {
    recipientId: userId,
    tokenCount,
    rows: (tokens || []).map((t) => ({
      id: t.id,
      user_id: t.user_id,
      enabled: t.enabled,
      platform: t.platform,
      tokenPreview: String(t.token || "").slice(0, 10),
    })),
    queryError: tokenErr?.message || null,
  });

  if (tokenErr) {
    console.error(LOG, "APNs failure", { reason: "token_lookup_failed", message: tokenErr.message });
    return { ok: false, error: tokenErr.message, sent: 0, failed: 0 };
  }

  console.log(LOG, "token count", {
    recipientId: userId,
    count: tokenCount,
    previews: (tokens || []).map((t) => String(t.token || "").slice(0, 10)),
  });

  if (!tokenCount) {
    const { data: allRows } = await supabase
      .from("push_tokens")
      .select("id, enabled, platform, user_id")
      .eq("user_id", userId);

    console.error(LOG, "APNs failure", {
      userId,
      anyRowsForUser: allRows?.length || 0,
      anyRowsPreview: (allRows || []).map((r) => ({
        id: r.id,
        enabled: r.enabled,
        platform: r.platform,
        user_id: r.user_id,
      })),
      hint:
        allRows?.length > 0
          ? "Token rows exist but none match enabled=true AND platform=ios"
          : "No push_tokens rows for this user_id — recipient must open app while logged in as that account",
    });
    return { ok: false, sent: 0, failed: 0, reason: "no_tokens", tokenCount: 0 };
  }

  const jwt = createApnsJwt(
    env.APNS_KEY_ID,
    env.APNS_TEAM_ID,
    normalizePrivateKey(env.APNS_PRIVATE_KEY)
  );

  const payload = {
    aps: {
      alert: {
        title: title || "ArmPal",
        body: body || "",
      },
      sound: "default",
    },
    ...data,
  };

  console.log(LOG, "APNS SEND START", {
    userId,
    tokenCount: tokens.length,
    topic: env.APNS_BUNDLE_ID,
    sandbox: env.APNS_USE_SANDBOX,
  });
  console.log(LOG, "PAYLOAD", payload);

  let sent = 0;
  let failed = 0;
  const results = [];

  for (const row of tokens) {
    try {
      const result = await sendApnsNotification({
        deviceToken: row.token,
        jwt,
        topic: env.APNS_BUNDLE_ID,
        payload,
        useSandbox: env.APNS_USE_SANDBOX,
      });

      if (result.status === 200) {
        sent += 1;
        results.push({ ok: true, tokenId: row.id, status: result.status });
        console.log(LOG, "APNs success", {
          tokenId: row.id,
          status: result.status,
          body: result.body || "",
        });
      } else {
        failed += 1;
        results.push({
          ok: false,
          tokenId: row.id,
          status: result.status,
          body: result.body,
        });
        console.error(LOG, "APNs failure", {
          tokenId: row.id,
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
      console.error(LOG, "APNs failure", err);
    }
  }

  return { ok: sent > 0 || failed === 0, sent, failed, tokenCount: tokens.length, results };
}
