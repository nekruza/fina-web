"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useUpdateProfile } from "@/lib/queries/profile";
import { useDeleteAllSavedConversations } from "@/lib/queries/conversations";
import { ConfirmDeleteDialog } from "@/components/conversation/ConfirmDeleteDialog";

/**
 * Settings → AI & privacy: the opt-in switch for keeping call transcripts, and
 * a way to delete every transcript already kept. The switch saves straight
 * away, separately from the profile form's Save button.
 */
export function TranscriptSavingSetting({ enabled }: { enabled: boolean }) {
  const updateProfile = useUpdateProfile();
  const deleteAll = useDeleteAllSavedConversations();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // The value the learner just picked, shown until the refetched profile catches up.
  const [pending, setPending] = useState<{ value: boolean; from: boolean } | null>(null);
  const on = pending && pending.from === enabled ? pending.value : enabled;

  const handleToggle = async () => {
    const next = !on;
    setPending({ value: next, from: enabled });
    try {
      await updateProfile.mutateAsync({ saveTranscripts: next });
      toast.success(next ? "Transcripts will be saved" : "Transcript saving is off. Saved transcripts are kept.");
    } catch {
      setPending(null);
      toast.error("Couldn't change this setting. Try again.");
    }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAll.mutateAsync();
      toast.success("All saved transcripts deleted");
    } catch {
      toast.error("Couldn't delete your transcripts. Try again.");
    } finally {
      setConfirmOpen(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-line p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 id="save-transcripts-label" className="text-base font-semibold text-ink">
            Save call transcripts
          </h3>
          <p id="save-transcripts-hint" className="mt-1 max-w-xl text-sm leading-6 text-sub">
            Keep the text of each call so you can read it again in{" "}
            <Link href="/app/progress" className="font-medium text-ink underline underline-offset-2">
              Progress
            </Link>
            , find new words, and see where you got stuck. Voice recordings are never stored.
            {on && " Turning this off stops saving new calls; transcripts you already saved stay until you delete them."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="save-transcripts-label"
          aria-describedby="save-transcripts-hint"
          onClick={handleToggle}
          disabled={updateProfile.isPending}
          className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand disabled:opacity-60 ${
            on ? "bg-accent-brand" : "bg-line"
          }`}
        >
          <span
            aria-hidden
            className={`inline-block h-5 w-5 rounded-full bg-surface shadow-sm transition-transform motion-reduce:transition-none ${
              on ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-hot underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hot"
      >
        Delete all saved transcripts
      </button>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleDeleteAll}
        title="Delete all saved transcripts?"
        description="Every saved conversation, with its transcript and feedback, will be removed from your history for good. Your streak stays."
        confirmLabel="Delete all"
        pending={deleteAll.isPending}
      />
    </div>
  );
}
