import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { canWriteSubscription, getStripe, subscriptionToProfileFields } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Confirms a completed Stripe Checkout session and (best-effort) writes the
 * Pro fields onto the profile immediately, so the settings page doesn't have
 * to wait on the webhook. Always redirects to `?upgraded=1` once a
 * session_id was supplied — even if the write above fails or the webhook
 * beat us to it — so the settings page's polling can pick up the change
 * whichever route lands first.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(req.url).origin;

  if (!sessionId) {
    return NextResponse.redirect(`${origin}/app/settings`);
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    const userId = session.client_reference_id;

    if (session.status === "complete" && userId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const subscription = session.subscription;
      if (subscription && typeof subscription !== "string") {
        const sub = subscription as Stripe.Subscription;
        const fields = subscriptionToProfileFields(sub);
        const admin = createAdminClient();

        // Stale-session guard: a delayed/duplicate success redirect must not
        // clobber a *different* subscription that is still live on the
        // profile. A different one that has ended (a returning subscriber's
        // old, canceled subscription) does not block the write.
        const { data: profile } = await admin
          .from("profiles")
          .select("stripe_subscription_id, pro_status")
          .eq("id", userId)
          .single();

        if (canWriteSubscription(profile ?? null, sub.id)) {
          const { error } = await admin.from("profiles").update(fields).eq("id", userId);
          if (error) console.error("[stripe/verify-purchase] profiles update error:", error);
        }
      }
    }
  } catch (err) {
    console.error("[stripe/verify-purchase] error:", err);
  }

  return NextResponse.redirect(`${origin}/app/settings?upgraded=1`);
}
