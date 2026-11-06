import "server-only"
import Stripe from "stripe"

// Koblip's own Stripe account (docs/plans/subscriptions.md, S1). The keys
// live only in .env.local: STRIPE_SECRET_KEY from Dashboard → Developers →
// API keys, STRIPE_WEBHOOK_SECRET from the webhook endpoint
// <BETTER_AUTH_URL>/api/auth/stripe/webhook. Without both, billing is off
// and lib/auth.ts leaves the Stripe plugin out, as it does Google.
export const stripeKeys =
  process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET
    ? {
        secretKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      }
    : null

// The API version is pinned, as Stripe advises
// (docs.stripe.com/api/versioning): the one stripe 23 is typed for.
export const stripeClient = stripeKeys
  ? new Stripe(stripeKeys.secretKey, { apiVersion: "2026-10-28.endive" })
  : null
