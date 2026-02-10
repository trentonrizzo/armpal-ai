import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
);

export default function StripeTestButton() {

  const testStripe = async () => {

    try {

      // AUTO detect current host + port
      const API_URL = `${window.location.origin}/api/create-checkout-session`;

      const response = await fetch(API_URL, {
        method: "POST",
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
