import { loadStripe } from "@stripe/stripe-js";
import { supabase } from "../supabaseClient";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
);

export default function StripeTestButton() {

  const testStripe = async () => {

    try {

      const API_URL = `${window.location.origin}/api/create-checkout-session`;

      // get current logged in user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user?.id,
        }),
      });

      if (!response.ok) {
        throw new Error("API route failed");
      }

      const data = await response.json();

      window.location.href = data.url;

    } catch (err) {
      console.error(err);
      alert("Checkout failed — check console");
    }

  };

  return (
    <button onClick={testStripe}>
      Test Stripe Connection
    </button>
  );
}
