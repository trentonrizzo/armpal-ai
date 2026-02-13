import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {

  const { userId } = req.body || {};

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const session = await stripe.checkout.sessions.create({
  mode: "payment",

  metadata: {
    userId: userId || "unknown",
  },


      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "ArmPal Test Purchase",
            },
            unit_amount: 100, // $1 test
          },
          quantity: 1,
        },
      ],

      success_url: `${req.headers.origin}/?stripe_return=1`,
      cancel_url: `${req.headers.origin}/`,
    });

    res.status(200).json({ url: session.url });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
