"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronDown, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile, useUpdateProfile } from "@/lib/queries/profile";
import { LANGUAGES, type LanguageId } from "@/lib/languages";
import { USER_LEVELS, type UserLevel } from "@/lib/levels";
import { TutorPicker } from "@/components/roleplay/TutorPicker";
import { AiPrivacySection } from "@/components/settings/AiPrivacySection";
import { VoucherRedeemForm } from "@/components/settings/VoucherRedeemForm";
import type { TutorId } from "@/lib/tutors";
import { isBillingPlan, type BillingPlan } from "@/lib/billing";
import { saveUserPreferences } from "@/lib/user-preferences";
import { ProUpgradeDialog } from "@/components/ProUpgradeDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DAILY_GOALS = [5, 10, 20, 30];
const DELETE_CONFIRM_WORD = "DELETE";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.1em] text-sub">
        {label}
      </label>
      <div className="relative mt-2">
        <select
          id={id}
          name={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-line bg-surface px-4 py-3 pr-10 text-sm text-ink transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sub"
          aria-hidden
        />
      </div>
    </div>
  );
}

const LANGUAGE_OPTIONS = LANGUAGES.map((l) => ({ value: l.id, label: `${l.flag} ${l.label}` }));
const LEVEL_OPTIONS = USER_LEVELS.map((l) => ({ value: l.id, label: l.label }));

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: profile, isLoading, refetch } = useProfile();
  const updateProfile = useUpdateProfile();

  const [displayName, setDisplayName] = useState("");
  const [level, setLevel] = useState<UserLevel>("beginner");
  const [targetLanguage, setTargetLanguage] = useState<LanguageId>("english");
  const [nativeLanguage, setNativeLanguage] = useState<LanguageId>("english");
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(10);
  const [tutorId, setTutorId] = useState<TutorId>("luna");
  const [saving, setSaving] = useState(false);

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<BillingPlan>("yearly");
  const [openingPortal, setOpeningPortal] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const planParamHandled = useRef(false);
  const upgradedParamHandled = useRef(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName);
    setLevel(profile.level);
    setTargetLanguage(profile.targetLanguage);
    setNativeLanguage(profile.nativeLanguage);
    setDailyGoalMinutes(profile.dailyGoalMinutes);
    setTutorId(profile.tutorId);
  }, [profile]);

  // `?plan=monthly|yearly` (set by the pro dialog's old settings link, and
  // still useful as a deep link) opens the upgrade dialog preselected to that
  // plan for a free user. Only applied once, so closing the dialog sticks.
  useEffect(() => {
    if (planParamHandled.current || !profile) return;
    planParamHandled.current = true;
    const plan = searchParams.get("plan");
    if (!profile.pro.isPro && isBillingPlan(plan)) {
      setUpgradePlan(plan);
      setShowUpgrade(true);
    }
  }, [profile, searchParams]);

  // `?upgraded=1` (from the checkout success redirect) — the webhook may not
  // have landed yet, so poll a few times before giving up. The welcome toast
  // is guarded by a ref (shown once), but the polling itself is NOT gated by
  // that ref: in React StrictMode, effects run mount → cleanup → mount, and
  // gating the poll loop's *restart* behind the same "already handled" ref
  // would let the first run's cleanup cancel the timer and then the second
  // run's guard would block it from ever being scheduled again — silently
  // dropping the poll entirely. Letting the effect body re-run freely (each
  // run's own cleanup only cancels its own timer) keeps this correct under
  // both StrictMode's double-invoke and normal single-invoke behavior.
  useEffect(() => {
    if (searchParams.get("upgraded") !== "1") return;

    if (!upgradedParamHandled.current) {
      upgradedParamHandled.current = true;
      toast.success("Welcome to Fina Pro!");
    }

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    const finish = () => {
      if (cancelled) return;
      router.replace("/app/settings", { scroll: false });
    };

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      const result = await refetch();
      if (cancelled) return;
      if (result.data?.pro.isPro) {
        finish();
        return;
      }
      if (attempts < 5) {
        timer = setTimeout(poll, 2000);
      } else {
        toast.info("Your upgrade is processing — it can take a minute to appear.");
        finish();
      }
    };

    timer = setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchParams, refetch, router]);

  const displayNameValid = displayName.trim().length > 0 && displayName.trim().length <= 100;

  async function handleSave() {
    if (!displayNameValid || saving || !profile) return;
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        displayName: displayName.trim(),
        level,
        targetLanguage,
      });
      saveUserPreferences(profile.id, { nativeLanguage, tutorId, dailyGoalMinutes });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleManageSubscription() {
    if (openingPortal) return;
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { url?: string };
      if (!res.ok || !body.url) {
        toast.error("Could not open the billing portal. Please try again.");
        return;
      }
      window.location.href = body.url;
    } catch {
      toast.error("Could not open the billing portal. Please try again.");
    } finally {
      setOpeningPortal(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== DELETE_CONFIRM_WORD || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete account. Please try again.");
        return;
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/");
    } catch {
      toast.error("Failed to delete account. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading || !profile) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-sub" aria-hidden />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] pb-16">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-brand">Your account</p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">Settings</h1>
        <p className="mt-2 max-w-[55ch] text-base text-sub">Your profile, learning preferences, and account.</p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav className="sticky top-8" aria-label="Settings sections">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sub">Settings</p>
            <div className="mt-3 flex flex-col gap-1">
              {[
                ["#profile", "Profile"],
                ["#learning", "Learning"],
                ["#ai-privacy", "AI & privacy"],
                ["#subscription", "Subscription"],
                ["#account", "Account"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-sub transition-[background-color,color] hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
                >
                  {label}
                </a>
              ))}
            </div>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
        <section id="profile" className="scroll-mt-24 rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <h2 className="font-display text-xl text-ink">Profile</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="settings-name" className="text-[11px] font-semibold uppercase tracking-[0.1em] text-sub">
                Display name
              </label>
              <input
                id="settings-name"
                name="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
                autoComplete="name"
                aria-invalid={!displayNameValid}
                className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
              />
              {!displayNameValid && (
                <p role="alert" className="mt-1.5 text-xs text-hot">
                  Display name is required.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="settings-email" className="text-[11px] font-semibold uppercase tracking-[0.1em] text-sub">
                Email
              </label>
              <input
                id="settings-email"
                name="email"
                type="email"
                value={profile.email}
                readOnly
                autoComplete="email"
                className="mt-2 w-full cursor-not-allowed rounded-xl border border-line bg-cream px-4 py-3 text-sm text-sub"
              />
            </div>
          </div>
        </section>

        <section id="learning" className="scroll-mt-24 rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <h2 className="font-display text-xl text-ink">Learning</h2>
          <div className="mt-5 space-y-5">
            <SelectField
              id="settings-target-language"
              label="Target language"
              value={targetLanguage}
              onChange={(v) => setTargetLanguage(v as LanguageId)}
              options={LANGUAGE_OPTIONS}
            />
            <SelectField
              id="settings-level"
              label="Level"
              value={level}
              onChange={(v) => setLevel(v as UserLevel)}
              options={LEVEL_OPTIONS}
            />
            <SelectField
              id="settings-native-language"
              label="Translation language"
              value={nativeLanguage}
              onChange={(v) => setNativeLanguage(v as LanguageId)}
              options={LANGUAGE_OPTIONS}
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-sub">Daily goal</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DAILY_GOALS.map((minutes) => {
                  const selected = dailyGoalMinutes === minutes;
                  return (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setDailyGoalMinutes(minutes)}
                      aria-pressed={selected}
                      className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand ${
                        selected ? "border-ink bg-ink text-cream" : "border-line bg-surface text-sub hover:border-sub/40"
                      }`}
                    >
                      {minutes} min
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-sub">Tutor</p>
              <div className="mt-3">
                <TutorPicker value={tutorId} onChange={setTutorId} size="sm" />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={!displayNameValid || saving}
            className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent-brand px-6 text-sm font-semibold text-cream transition hover:bg-accent-brand/90 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </section>

        <AiPrivacySection />

        <section id="subscription" className="scroll-mt-24 rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <h2 className="font-display text-xl text-ink">Subscription</h2>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {profile.pro.isPro ? (
              <p className="text-sm text-ink">
                <span className="font-semibold">Fina Pro</span> ·{" "}
                {!profile.pro.currentPeriodEnd
                  ? "active"
                  : profile.pro.hasSubscription
                    ? `renews ${formatDate(profile.pro.currentPeriodEnd)}`
                    : `free until ${formatDate(profile.pro.currentPeriodEnd)}`}
              </p>
            ) : (
              <p className="text-sm text-ink">
                Free plan — {profile.usage.freeConversationsRemaining} free conversations and{" "}
                {profile.usage.freeGenerationsRemaining} free word generations left
              </p>
            )}

            {/* Pro from a voucher has no Stripe subscription, so nothing to manage. */}
            {profile.pro.isPro && profile.pro.hasSubscription && (
              <button
                type="button"
                onClick={handleManageSubscription}
                disabled={openingPortal}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink transition hover:border-sub/40 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
              >
                {openingPortal && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Manage subscription
              </button>
            )}
            {!profile.pro.isPro && (
              <button
                type="button"
                onClick={() => {
                  setUpgradePlan("yearly");
                  setShowUpgrade(true);
                }}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-cream transition hover:bg-ink/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
              >
                Upgrade to Pro
              </button>
            )}
          </div>
          {!profile.pro.isPro && <VoucherRedeemForm onRedeemed={() => void refetch()} />}
        </section>

        <section id="account" className="scroll-mt-24 rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <h2 className="font-display text-xl text-ink">Account</h2>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-sub/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
            >
              Sign out
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="rounded-full border border-hot/30 bg-surface px-5 py-2.5 text-sm font-semibold text-hot transition hover:bg-hot/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hot"
            >
              Delete account
            </button>
          </div>
          <p className="mt-6 text-xs text-sub">
            <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
              Privacy
            </Link>
            <span className="mx-2">·</span>
            <Link href="/terms" className="underline underline-offset-2 hover:text-ink">
              Terms
            </Link>
          </p>
        </section>
        </div>
      </div>

      <ProUpgradeDialog
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason="upgrade"
        initialPlan={upgradePlan}
      />

      <Dialog
        open={showDeleteDialog}
        onOpenChange={(next) => {
          setShowDeleteDialog(next);
          if (!next) setDeleteConfirmText("");
        }}
      >
        <DialogContent className="rounded-2xl border-line bg-surface text-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-normal text-ink">Delete your account?</DialogTitle>
            <DialogDescription className="text-sm text-sub">
              This permanently deletes your account and everything in it, including conversations, vocabulary, and progress.
              This cannot be undone. Type {DELETE_CONFIRM_WORD} to confirm.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor="delete-confirm" className="sr-only">
              Type {DELETE_CONFIRM_WORD} to confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={DELETE_CONFIRM_WORD}
              autoComplete="off"
              className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-sub/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hot"
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
              className="h-10 rounded-full px-5 text-sm font-semibold text-sub transition hover:text-ink disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== DELETE_CONFIRM_WORD || deleting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-hot px-5 text-sm font-semibold text-cream transition hover:bg-hot/90 disabled:opacity-40"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {deleting ? "Deleting…" : "Delete account"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
