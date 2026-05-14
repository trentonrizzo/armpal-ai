// api/send-reset-email.js
// Server-side password recovery email (optional). Uses Supabase Auth /recover
// with an explicit redirect_to so links never rely on a stale Site URL alone.

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Missing email" });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceRole) {
      return res.status(500).json({
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const siteBase = (
      process.env.PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
    )
      .trim()
      .replace(/\/+$/, "");

    const redirectTo = siteBase ? `${siteBase}/reset-password` : "";

    if (!redirectTo) {
      return res.status(500).json({
        error:
          "Set PUBLIC_SITE_URL or SITE_URL to your live https origin (e.g. https://www.armpal.net) so recovery emails use the correct domain.",
      });
    }

    const apiKey = anonKey || serviceRole;

    const recoverRes = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email,
        redirect_to: redirectTo,
      }),
    });

    if (!recoverRes.ok) {
      let detail = "";
      try {
        detail = await recoverRes.text();
      } catch {
        /* ignore */
      }
      return res.status(400).json({
        error: detail || `Recover request failed (${recoverRes.status})`,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
};
