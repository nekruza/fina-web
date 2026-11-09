"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDeleteSavedConversation, useSavedConversation } from "@/lib/queries/conversations";
import { CallTranscript } from "@/components/conversation/CallTranscript";
import { ConfirmDeleteDialog } from "@/components/conversation/ConfirmDeleteDialog";
import { formatDuration } from "@/components/conversation/AnalysisResults";
import { getLanguage } from "@/lib/languages";
import { getTutorById } from "@/lib/tutors";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const backLink =
  "inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-sub transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand";

/** One saved call: when it was, how it went, and the full transcript with the lines that need work marked. */
export default function SavedConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: conversation, isLoading, isError } = useSavedConversation(id);
  const deleteConversation = useDeleteSavedConversation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const back = (
    <Link href="/app/progress" className={backLink}>
      <ChevronLeft className="h-4 w-4" aria-hidden />
      Progress
    </Link>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        {back}
        <p role="status" className="mt-6 text-sm text-sub">
          Loading transcript…
        </p>
      </div>
    );
  }

  if (isError || !conversation) {
    return (
      <div className="mx-auto max-w-3xl">
        {back}
        <div className="mt-6 rounded-[1.75rem] border border-line bg-surface p-8">
          <h1 className="font-display text-2xl text-ink">This transcript isn&apos;t available</h1>
          <p className="mt-2 text-sub">It may have been deleted. Your other saved conversations are in Progress.</p>
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteConversation.mutateAsync(conversation.id);
      toast.success("Transcript deleted");
      router.push("/app/progress");
    } catch {
      toast.error("Couldn't delete the transcript. Try again.");
    } finally {
      setConfirmOpen(false);
    }
  };

  const language = getLanguage(conversation.language);
  const tutor = getTutorById(conversation.tutorId);
  const details = [
    formatDate(conversation.startedAt),
    conversation.durationSeconds != null ? formatDuration(conversation.durationSeconds) : null,
    conversation.overallScore != null ? `Score ${Math.round(conversation.overallScore)}` : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {back}

      <header>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-sub">
          <span aria-hidden className="text-base">
            {language.flag}
          </span>
          {language.label} · with {tutor.name}
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">{conversation.roleplayTitle}</h1>
        <p className="mt-2 text-sm text-sub">{details.join(" · ")}</p>
        {conversation.analysis?.summary && (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink">{conversation.analysis.summary}</p>
        )}
      </header>

      <CallTranscript
        messages={conversation.messages}
        tutorName={tutor.name}
        corrections={conversation.analysis?.corrections ?? []}
      />

      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-hot/30 bg-surface px-5 text-sm font-semibold text-hot transition hover:bg-hot/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hot"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Delete transcript
      </button>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleDelete}
        title="Delete this transcript?"
        description="It will be removed from your history for good."
        confirmLabel="Delete"
        pending={deleteConversation.isPending}
      />
    </div>
  );
}
