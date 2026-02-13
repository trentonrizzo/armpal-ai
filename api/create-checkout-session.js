import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {

    const session = await stripe.checkout.sessions.create({

      mode: "subscription", // 🔥 CHANGE: subscription instead of payment

      payment_method_types: ["card"],

      metadata: {
        userId,
      },

      line_items: [
        {
          price: "price_1T0VK1EWkdbPZFlhzbkesA7L", // 🔥 YOUR $7.99 STRIPE PRICE ID
          quantity: 1,
        },
      ],

      success_url: `${req.headers.origin}/?stripe_return=1`,
      cancel_url: `${req.headers.origin}/`,
    });

    res.status(200).json({ url: session.url });

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: err.message });

  }
}
