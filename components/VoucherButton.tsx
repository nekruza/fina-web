"use client";

import { useState } from "react";
import { Gift } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VoucherRedeemForm } from "@/components/settings/VoucherRedeemForm";
import { useProfile } from "@/lib/queries/profile";
import { QUERY_KEYS } from "@/lib/queries/keys";
import { track } from "@/lib/mixpanel";

interface VoucherButtonProps {
  /** `sidebar` is the full-width desktop rail button; `header` is the compact mobile pill. */
  variant: "sidebar" | "header";
}

// Deliberately the loudest thing in the shell: a first-time learner holding a
// voucher should find it without opening settings.
const GRADIENT =
  "bg-linear-to-r from-[#C8451F] to-[#B8336A] text-white shadow-[0_6px_16px_-6px_rgba(200,69,31,0.55)] transition-[filter,transform] duration-150 ease-out hover:brightness-110 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand";

/**
 * Opens the voucher redeem dialog from the app shell. Renders nothing for
 * learners who already have Pro, or until the profile has loaded.
 */
export function VoucherButton({ variant }: VoucherButtonProps) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  if (!profile || profile.pro.isPro) return null;

  function handleOpen() {
    setOpen(true);
    track("voucher_entry_opened", { source: variant });
  }

  function handleRedeemed() {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversationUsage });
    setOpen(false);
  }

  return (
    <>
      {variant === "sidebar" ? (
        <button
          type="button"
          onClick={handleOpen}
          className={`mb-3 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold ${GRADIENT}`}
        >
          <Gift className="h-[18px] w-[18px] shrink-0" aria-hidden />
          Have a voucher?
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold ${GRADIENT}`}
        >
          <Gift className="h-4 w-4 shrink-0" aria-hidden />
          Voucher
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 rounded-[1.75rem] border-line bg-surface p-0 text-ink sm:max-w-md">
          <div className="px-6 py-7 sm:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-brand">Fina Pro</p>
            <DialogHeader className="mt-2 text-left">
              <DialogTitle className="font-display text-2xl leading-tight font-normal text-ink">
                Redeem your voucher
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-sub">
                Enter the code you were given to unlock Fina Pro. No card needed.
              </DialogDescription>
            </DialogHeader>
            <VoucherRedeemForm onRedeemed={handleRedeemed} className="mt-5" autoFocus />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
