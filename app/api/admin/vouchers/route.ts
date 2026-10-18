import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseVoucherCreate } from "@/lib/vouchers";

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = "23505";

/** Lists every voucher code, newest first. */
export async function GET() {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const { data, error } = await createAdminClient()
    .from("voucher_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/vouchers] list error:", error);
    return NextResponse.json({ error: "Failed to load vouchers" }, { status: 500 });
  }
  return NextResponse.json({ vouchers: data ?? [] });
}

/** Creates a voucher code. A blank `code` generates a random one. */
export async function POST(req: NextRequest) {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const parsed = parseVoucherCreate(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await createAdminClient().from("voucher_codes").insert(parsed.value).select("*").single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return NextResponse.json({ error: "A voucher with that code already exists" }, { status: 409 });
    }
    console.error("[admin/vouchers] create error:", error);
    return NextResponse.json({ error: "Failed to create voucher" }, { status: 500 });
  }
  return NextResponse.json({ voucher: data }, { status: 201 });
}
