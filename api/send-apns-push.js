import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import http2 from "node:http2";

export const config = { runtime: "nodejs" };

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const internalSecret = process.env.PUSH_INTERNAL_SECRET;
  if (internalSecret && req.headers["x-push-secret"] !== internalSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const {
    APNS_KEY_ID,
    APNS_TEAM_ID,
    APNS_BUNDLE_ID,
    APNS_PRIVATE_KEY,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env;

  if (
    !APNS_KEY_ID ||
    !APNS_TEAM_ID ||
    !APNS_BUNDLE_ID ||
    !APNS_PRIVATE_KEY ||
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    return res.status(503).json({
      ok: false,
      error: "APNs not configured",
      sent: 0,
      failed: 0,
    });
  }

  const { userId, title, body, data = {} } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: tokenRows, error: tokenErr } = await supabase
    .from("push_tokens")
    .select("id, token")
    .eq("user_id", userId)
    .eq("enabled", true)
    .eq("platform", "ios");

  if (tokenErr) {
    return res.status(500).json({ error: tokenErr.message, sent: 0, failed: 0 });
  }

  if (!tokenRows?.length) {
    return res.status(200).json({ ok: true, sent: 0, failed: 0, reason: "no_tokens" });
  }

  const jwt = createApnsJwt(
    APNS_KEY_ID,
    APNS_TEAM_ID,
    normalizePrivateKey(APNS_PRIVATE_KEY)
  );
  const useSandbox = process.env.APNS_USE_SANDBOX === "true";

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

  let sent = 0;
  let failed = 0;
  const results = [];

  for (const row of tokenRows) {
    try {
      const result = await sendApnsNotification({
        deviceToken: row.token,
        jwt,
        topic: APNS_BUNDLE_ID,
        payload: apnsPayload,
        useSandbox,
      });

      if (result.status === 200) {
        sent += 1;
        results.push({ ok: true, tokenId: row.id });
      } else {
        failed += 1;
        results.push({
          ok: false,
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
    }
  }

  return res.status(200).json({ ok: true, sent, failed, results });
}
