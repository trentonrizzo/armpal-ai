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

    console.log("Checkout completed for user:", userId);

    if (userId) {

      const { error } = await supabase
        .from("profiles")
        .update({ is_pro: true })
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

  res.status(200).json({ received: true });
}
