import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileRow } from "@/lib/db/profile";
import { needsOnboarding } from "@/lib/onboarding-storage";
import { isAuthDisabled, TEMPORARY_AUTH_USER } from "@/lib/auth-config";
import { AppLayoutClient } from "./AppLayoutClient";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const bypassAuth = isAuthDisabled();
  const supabase = bypassAuth ? null : await createClient();
  const user = bypassAuth
    ? TEMPORARY_AUTH_USER
    : (await supabase!.auth.getUser()).data.user;

  if (!user) redirect("/login");

  // Non-PGRST116 read failures (getProfileRow throws) fall through and let
  // the page render rather than redirect-looping into /onboarding.
  let profileRow = null;
  if (!bypassAuth) {
    try {
      profileRow = await getProfileRow(supabase!, user.id);
    } catch {
      profileRow = undefined;
    }
  }

  if (!bypassAuth && profileRow !== undefined && needsOnboarding(profileRow)) {
    redirect("/onboarding");
  }

  const metadataAvatar = user.user_metadata?.avatar_url;
  const avatarUrl = typeof metadataAvatar === "string" ? metadataAvatar : null;

  return (
    <div className="flex min-h-screen flex-col bg-cream md:flex-row">
      <AppLayoutClient
        userId={user.id}
        userEmail={user.email ?? null}
        avatarUrl={avatarUrl}
      >
        {children}
      </AppLayoutClient>
    </div>
  );
}
