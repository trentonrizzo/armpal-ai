import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🔥 IMPORTANT — Vercel server env (NOT VITE_)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"];

  let event;

  try {

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const rawBody = Buffer.concat(chunks);

    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 🔥 PAYMENT SUCCESS
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const stripeCustomerId = session.customer || null;

    console.log("Checkout completed for user:", userId);

    if (userId) {
      const updates = { is_pro: true };
      if (stripeCustomerId) updates.stripe_customer_id = stripeCustomerId;

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (error) {
        console.error("Supabase update failed:", error);
      } else {
        console.log("User upgraded to PRO successfully");
      }
    } else {
      console.log("No userId found in metadata");
    }
  }

  // 🔥 INVOICE.PAID — Referral reward when referred user pays for Pro (double-sided)
  if (event.type === "invoice.paid") {
    const invoice = event.data.object;

    // Resolve subscriber user from stripe_customer_id
    const { data: subscriberProfile } = await supabase
      .from("profiles")
      .select("id, referred_by")
      .eq("stripe_customer_id", invoice.customer)
      .maybeSingle();

    if (!subscriberProfile) return;
    if (!subscriberProfile.referred_by) return;

    // Find referrer by referral_code
    const { data: referrerProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", subscriberProfile.referred_by)
      .maybeSingle();

    if (!referrerProfile) return;

    // Check duplicate reward
    const { data: existingReward } = await supabase
      .from("referral_rewards")
      .select("id")
      .eq("referrer_user_id", referrerProfile.id)
      .eq("referred_user_id", subscriberProfile.id)
      .eq("reward_type", "pro_signup")
      .maybeSingle();

    if (existingReward) return;

    // --------------------------------------------------
    // DOUBLE-SIDED REWARD
    // --------------------------------------------------

    // 1) Referrer gets 100 credits
    await supabase.rpc("add_points_safe", {
      target_user: referrerProfile.id,
      points_amount: 100,
      reason_text: "Referral Pro Signup",
      related: subscriberProfile.id,
    });

    // 2) New Pro user gets 50 credits
    await supabase.rpc("add_points_safe", {
      target_user: subscriberProfile.id,
      points_amount: 50,
      reason_text: "Referral Bonus (Welcome)",
      related: referrerProfile.id,
    });

    // Insert lock record to prevent duplicate rewards
    await supabase.from("referral_rewards").insert({
      referrer_user_id: referrerProfile.id,
      referred_user_id: subscriberProfile.id,
      reward_type: "pro_signup",
    });
  }

  res.status(200).json({ received: true });
}
