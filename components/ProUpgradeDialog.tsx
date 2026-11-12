"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FREE_CONVERSATIONS, FREE_GENERATIONS, PLANS, type BillingPlan } from "@/lib/billing";

export type ProUpgradeReason = "conversations" | "generations" | "upgrade";

interface ProUpgradeDialogProps {
  open: boolean;
  onClose: () => void;
  reason: ProUpgradeReason;
  /** Plan to preselect when the dialog opens (e.g. from `?plan=` on settings). */
  initialPlan?: BillingPlan;
}

const TITLES: Record<ProUpgradeReason, string> = {
  conversations: "You've used your free conversations",
  generations: "You've used your free word generations",
  upgrade: "Upgrade to Fina Pro",
};

const DESCRIPTIONS: Record<ProUpgradeReason, string> = {
  conversations: `Free accounts include ${FREE_CONVERSATIONS} voice conversations. Fina Pro gives you unlimited practice.`,
  generations: `Free accounts include ${FREE_GENERATIONS} AI word generations. Fina Pro gives you unlimited word lists.`,
  upgrade: "Practice as much as you like, with every tutor and every roleplay.",
};

const BENEFITS = [
  "Unlimited voice conversations",
  "Unlimited AI word generation",
  "All 10 languages & tutors",
  "Detailed conversation analysis",
];

const PLAN_ORDER: BillingPlan[] = ["yearly", "monthly"];

export function ProUpgradeDialog({ open, onClose, reason, initialPlan = "yearly" }: ProUpgradeDialogProps) {
  const [plan, setPlan] = useState<BillingPlan>(initialPlan);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Reset the selected plan to `initialPlan` whenever the dialog transitions
  // to open — adjusted during render (React's documented pattern for
  // resetting state on a prop change) rather than in a `useEffect`, so there
  // is no extra render-then-setState round trip.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPlan(initialPlan);
  }

  async function handleUpgrade() {
    if (isRedirecting) return;
    setIsRedirecting(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const body = await res.json().catch(() => ({}) as { url?: string; error?: string });

      if (!res.ok || !body.url) {
        toast.error(body.error === "already_pro" ? "You're already on Fina Pro." : "Could not start checkout. Please try again.");
        setIsRedirecting(false);
        return;
      }

      // Leave the button disabled while the browser navigates away — resetting
      // it here would let a slow redirect show a briefly re-enabled dialog.
      window.location.href = body.url;
    } catch {
      toast.error("Could not start checkout. Please try again.");
      setIsRedirecting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 rounded-[1.75rem] border-line bg-surface p-0 text-ink sm:max-w-md">
        <div className="px-6 pt-7 pb-5 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-brand">Fina Pro</p>
          <DialogHeader className="mt-2 text-left">
            <DialogTitle className="font-display text-2xl leading-tight font-normal text-ink">
              {TITLES[reason]}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-sub">
              {DESCRIPTIONS[reason]}
            </DialogDescription>
          </DialogHeader>

          <ul className="mt-5 space-y-2.5">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-3 text-sm text-ink">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-brand">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <fieldset className="border-t border-line px-6 py-5 sm:px-8">
          <legend className="sr-only">Billing plan</legend>
          <div className="grid grid-cols-2 gap-2.5">
            {PLAN_ORDER.map((id) => {
              const p = PLANS[id];
              const selected = plan === id;
              return (
                <label
                  key={id}
                  className={`relative cursor-pointer rounded-2xl border px-4 py-3 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-brand ${
                    selected ? "border-ink bg-cream" : "border-line bg-surface hover:border-sub/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="fina-pro-plan"
                    value={id}
                    checked={selected}
                    onChange={() => setPlan(id)}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between text-sm font-semibold text-ink">
                    {p.label}
                    {id === "yearly" && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent-brand">
                        Save 50%
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm text-ink">{p.display}</span>
                  <span className="block text-xs text-sub">
                    {id === "yearly" ? `${p.perMonth}/month, billed yearly` : "Billed monthly"}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2 border-t border-line px-6 py-5 sm:px-8">
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={isRedirecting}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-[15px] font-semibold text-cream transition hover:bg-ink/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand disabled:opacity-60"
          >
            {isRedirecting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Upgrade to Pro
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isRedirecting}
            className="h-10 rounded-full text-sm font-semibold text-sub transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand disabled:opacity-60"
          >
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
