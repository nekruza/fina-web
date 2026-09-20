import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  redirect(user ? "/app" : "/login");
}

export default Home;
