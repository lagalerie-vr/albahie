import "server-only";
import Stripe from "stripe";

/** Whether Stripe is configured (test or live secret key present). */
export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let client: Stripe | null = null;

/** Server-only Stripe client. Throws if STRIPE_SECRET_KEY is missing. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!client) client = new Stripe(key);
  return client;
}
