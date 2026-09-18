import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

/** Deleted in dependency order so no orphaned rows are left behind on partial failure. */
const TABLES_TO_DELETE = [
  "generated_lessons",
  "custom_roleplays",
  "favorite_words",
  "lesson_progress",
  "profiles",
] as const;

/** Statuses where the subscription is still billing and must be canceled before the account goes away. */
const BILLING_PRO_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id, pro_status")
    .eq("id", user.id)
    .single();

  if (profile?.stripe_subscription_id && BILLING_PRO_STATUSES.has(profile.pro_status ?? "")) {
    try {
      await getStripe().subscriptions.cancel(profile.stripe_subscription_id);
    } catch (err) {
      console.error("[api/account] failed to cancel subscription before delete:", err);
      return NextResponse.json(
        { error: "Couldn't cancel your subscription. Please try again or manage it in billing." },
        { status: 502 }
      );
    }
  }

  for (const table of TABLES_TO_DELETE) {
    const idColumn = table === "profiles" ? "id" : "user_id";
    const { error } = await supabase.from(table).delete().eq(idColumn, user.id);
    if (error) {
      return NextResponse.json({ error: "Failed to delete account data" }, { status: 500 });
    }
  }

  let authDeleted = false;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    authDeleted = !error;
  }

  return NextResponse.json({ ok: true, authDeleted });
}
