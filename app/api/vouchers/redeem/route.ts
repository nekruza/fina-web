import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { REDEEM_ERRORS, isRedeemStatus, isValidVoucherCode, normalizeVoucherCode } from "@/lib/vouchers";

/**
 * Redeems a voucher code for the signed-in user. All validation (active,
 * date window, usage limit, one use per user, not already Pro) and the Pro
 * grant happen atomically in the `redeem_voucher` Postgres function, which
 * only the service role may call.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? normalizeVoucherCode(body.code) : "";
  // A malformed code can't exist in the table, so skip the round trip.
  if (!isValidVoucherCode(code)) {
    return NextResponse.json({ error: REDEEM_ERRORS.invalid.message, status: "invalid" }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[vouchers/redeem] SUPABASE_SERVICE_ROLE_KEY not configured");
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { data, error } = await createAdminClient().rpc("redeem_voucher", { p_code: code, p_user_id: user.id });
  const result = data as { status?: unknown; pro_until?: string } | null;

  if (error || !isRedeemStatus(result?.status)) {
    console.error("[vouchers/redeem] redeem_voucher error:", error ?? result);
    return NextResponse.json({ error: "Could not redeem the code. Please try again." }, { status: 500 });
  }

  if (result.status !== "ok") {
    const { status, message } = REDEEM_ERRORS[result.status];
    return NextResponse.json({ error: message, status: result.status }, { status });
  }

  return NextResponse.json({ status: "ok", proUntil: result.pro_until ?? null });
}
