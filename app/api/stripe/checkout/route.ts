import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileRow } from "@/lib/db/profile";
import { getStripe } from "@/lib/stripe";
import { isBillingPlan, hasProAccess, PLANS } from "@/lib/billing";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { plan?: unknown } | null;
  if (!body || !isBillingPlan(body.plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  const plan = body.plan;

  const row = await getProfileRow(supabase, user.id);
  if (hasProAccess(row)) {
    return NextResponse.json({ error: "already_pro" }, { status: 409 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(req.url).origin;
  const planDetails = PLANS[plan];

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: planDetails.currency,
            unit_amount: planDetails.amountCents,
            recurring: { interval: planDetails.interval },
            product_data: {
              name: "Fina Pro",
              description: "Unlimited AI voice conversations and word generation",
            },
          },
        },
      ],
      customer: row?.stripe_customer_id ?? undefined,
      customer_email: row?.stripe_customer_id ? undefined : (user.email ?? undefined),
      client_reference_id: user.id,
      metadata: { user_id: user.id, plan },
      subscription_data: { metadata: { user_id: user.id, plan } },
      allow_promotion_codes: true,
      success_url: `${origin}/api/stripe/verify-purchase?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/settings?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe error";
    console.error("[stripe/checkout]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
