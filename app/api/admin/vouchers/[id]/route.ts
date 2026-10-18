import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseVoucherPatch } from "@/lib/vouchers";

/** Postgres check_violation and foreign_key_violation. */
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";

type Params = { params: Promise<{ id: string }> };

/** One voucher plus who redeemed it (email from `profiles`) and when. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireAdmin();
  if (!user) return response;
  const { id } = await params;
  const admin = createAdminClient();

  const { data: voucher, error } = await admin.from("voucher_codes").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[admin/vouchers/:id] load error:", error);
    return NextResponse.json({ error: "Failed to load voucher" }, { status: 500 });
  }
  if (!voucher) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: redemptions, error: redemptionsError } = await admin
    .from("voucher_redemptions")
    .select("user_id, redeemed_at, pro_until")
    .eq("voucher_id", id)
    .order("redeemed_at", { ascending: false });
  if (redemptionsError) {
    console.error("[admin/vouchers/:id] redemptions error:", redemptionsError);
    return NextResponse.json({ error: "Failed to load redemptions" }, { status: 500 });
  }

  const rows = (redemptions ?? []) as { user_id: string; redeemed_at: string; pro_until: string }[];
  const emails = new Map<string, string | null>();
  if (rows.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", rows.map((r) => r.user_id));
    for (const p of (profiles ?? []) as { id: string; email: string | null }[]) emails.set(p.id, p.email);
  }

  return NextResponse.json({
    voucher,
    redemptions: rows.map((r) => ({
      userId: r.user_id,
      email: emails.get(r.user_id) ?? null,
      redeemedAt: r.redeemed_at,
      proUntil: r.pro_until,
    })),
  });
}

/** Updates active / description / usage limit / date window. Code and duration are fixed. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, response } = await requireAdmin();
  if (!user) return response;
  const { id } = await params;

  const parsed = parseVoucherPatch(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await createAdminClient()
    .from("voucher_codes")
    .update({ ...parsed.value, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === CHECK_VIOLATION) {
      return NextResponse.json({ error: "Expiry must be after the start date" }, { status: 400 });
    }
    console.error("[admin/vouchers/:id] update error:", error);
    return NextResponse.json({ error: "Failed to update voucher" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ voucher: data });
}

/** Deletes a code that has never been redeemed. Used codes can only be deactivated. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireAdmin();
  if (!user) return response;
  const { id } = await params;

  const { data, error } = await createAdminClient().from("voucher_codes").delete().eq("id", id).select("id");

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return NextResponse.json(
        { error: "This code has been redeemed, so it can't be deleted. Deactivate it instead." },
        { status: 409 }
      );
    }
    console.error("[admin/vouchers/:id] delete error:", error);
    return NextResponse.json({ error: "Failed to delete voucher" }, { status: 500 });
  }
  if (!data || data.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
