"use client";

import { FC } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useFeedbackDialog } from "@/components/FeedbackProvider";
import {
  Home,
  Mic,
  BookOpen,
  CalendarDays,
  TrendingUp,
  LogOut,
  MessageSquare,
  UserPlus,
} from "lucide-react";

const navItems = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/roleplay", label: "Speak", icon: Mic },
  { href: "/app/vocabulary", label: "Words", icon: BookOpen },
  { href: "/app/study-plan", label: "Plan", icon: CalendarDays },
  { href: "/app/progress", label: "Progress", icon: TrendingUp },
];

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}

interface AppSidebarProps {
  userEmail: string | null;
  avatarUrl: string | null;
}

function UserAvatar({ avatarUrl, initials, size = "md" }: { avatarUrl: string | null; initials: string; size?: "sm" | "md" }) {
  const dimensions = size === "sm" ? 32 : 40;

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent-soft font-semibold text-accent-brand ${
        size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-xs"
      }`}
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt="" width={dimensions} height={dimensions} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

export const AppSidebar: FC<AppSidebarProps> = ({ userEmail, avatarUrl }) => {
  const isAuthed = !!userEmail;
  const pathname = usePathname();
  const router = useRouter();
  const feedbackDialog = useFeedbackDialog();

  async function handleSignOut() {
    // Loaded on demand so supabase-js stays out of the app shell's first-load JS.
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const initials = userEmail ? userEmail.split("@")[0].slice(0, 2).toUpperCase() : "";

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 border-r border-line bg-surface md:flex md:flex-col">
        <div className="flex h-full flex-col px-4 py-5">
          <Link
            href="/app"
            className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
          >
            <Image src="/logo.png" alt="Fina" width={40} height={40} className="rounded-xl" priority />
            <span className="min-w-0">
              <span className="block font-display text-xl leading-none text-ink">Fina</span>
              <span className="mt-1 block text-[11px] font-medium text-sub">Your learning space</span>
            </span>
          </Link>

          <nav aria-label="Primary navigation" className="mt-10 flex flex-col gap-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sub">Practice & learn</p>
            <div className="mt-3 flex flex-col gap-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-[background-color,color,box-shadow] hover:bg-cream hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand ${
                      active ? "bg-accent-soft font-semibold text-accent-brand" : "text-sub"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.25 : 1.9} aria-hidden />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="mt-auto border-t border-line pt-4">
            <button
              type="button"
              onClick={feedbackDialog.open}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-sub transition-[background-color,color] hover:bg-cream hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
            >
              <MessageSquare className="h-[18px] w-[18px]" aria-hidden />
              Give feedback
            </button>

            {isAuthed ? (
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-cream p-2.5">
                <Link
                  href="/app/settings"
                  aria-label="Settings"
                  className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
                >
                  <UserAvatar avatarUrl={avatarUrl} initials={initials} />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sub">Signed in as</p>
                  <p className="mt-0.5 truncate text-xs font-medium text-ink">{userEmail}</p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sub transition-[background-color,color] hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent-soft px-3 text-sm font-semibold text-accent-brand transition-[background-color] hover:bg-accent-soft/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
              >
                <UserPlus className="h-4 w-4" aria-hidden />
                Sign in
              </Link>
            )}
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-cream/95 px-5 backdrop-blur md:hidden">
        <Link href="/app" className="flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand">
          <Image src="/logo.png" alt="Fina" width={32} height={32} className="rounded-lg" priority />
          <span className="font-display text-xl text-ink">Fina</span>
        </Link>
        {isAuthed ? (
          <Link
            href="/app/settings"
            aria-label="Open settings"
            className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
          >
            <UserAvatar avatarUrl={avatarUrl} initials={initials} size="sm" />
          </Link>
        ) : (
          <Link href="/login" className="rounded-md text-sm font-semibold text-accent-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-brand">
            Sign in
          </Link>
        )}
      </header>

      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 px-2 backdrop-blur md:hidden">
        <div className="flex items-center justify-around gap-1" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))", paddingTop: "8px" }}>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 min-w-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold transition-[background-color,color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand ${
                  active ? "bg-accent-soft text-accent-brand" : "text-sub hover:bg-cream hover:text-ink"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};
