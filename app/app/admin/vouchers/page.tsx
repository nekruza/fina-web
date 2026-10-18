import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/require-admin";
import { VoucherAdmin } from "./VoucherAdmin";

/** Admin-only. Everyone else gets a 404, same as the admin API. */
export default async function AdminVouchersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) notFound();

  return <VoucherAdmin />;
}
