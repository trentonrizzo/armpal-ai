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

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return res.status(500).json({ error: "STRIPE_PRICE_ID not configured" });
  }

  try {

    const session = await stripe.checkout.sessions.create({

      mode: "subscription",

      payment_method_types: ["card"],

      metadata: {
        userId,
      },

      line_items: [
        {
          price: priceId,
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
