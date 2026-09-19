"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useProfile } from "@/lib/queries/profile";
import { useCustomRoleplays, useDeleteCustomRoleplay } from "@/lib/queries/roleplays";
import { roleplays } from "@/lib/data/roleplays";
import { customToScenario, filterScenarios, type RoleplayFilter } from "@/lib/roleplay-filter";
import { TutorPicker } from "@/components/roleplay/TutorPicker";
import { RoleplayCard } from "@/components/roleplay/RoleplayCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEFAULT_TUTOR_ID, isTutorId, type TutorId } from "@/lib/tutors";
import type { RoleplayScenario } from "@/lib/types/roleplay";
import { saveUserPreferences } from "@/lib/user-preferences";

const FILTERS: { id: RoleplayFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "custom", label: "Custom" },
  { id: "life", label: "Life" },
  { id: "food", label: "Food" },
  { id: "travel", label: "Travel" },
  { id: "work", label: "Work" },
];

function isRoleplayFilter(value: string | null): value is RoleplayFilter {
  return value === "all" || value === "custom" || value === "life" || value === "food" || value === "travel" || value === "work";
}

export default function RoleplayPage() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter");
  const [filter, setFilter] = useState<RoleplayFilter>(isRoleplayFilter(filterParam) ? filterParam : "all");

  const profileQuery = useProfile();
  // `optimisticTutorId` overrides the profile's tutor while a change is in flight (or once it
  // has landed, until the next profile refetch). Deriving `tutorId` this way — rather than
  // syncing profile.tutorId into local state via an effect — keeps a single source of truth and
  // avoids a setState-in-effect render cascade.
  const [optimisticTutorId, setOptimisticTutorId] = useState<TutorId | null>(null);
  const profileTutorId = profileQuery.data?.tutorId;
  const tutorId: TutorId = optimisticTutorId ?? (isTutorId(profileTutorId) ? profileTutorId : DEFAULT_TUTOR_ID);

  const customQuery = useCustomRoleplays();
  const deleteCustomRoleplay = useDeleteCustomRoleplay();
  const [pendingDelete, setPendingDelete] = useState<RoleplayScenario | null>(null);

  const customScenarios = useMemo(() => (customQuery.data ?? []).map(customToScenario), [customQuery.data]);
  const customIds = useMemo(() => new Set(customScenarios.map((s) => s.id)), [customScenarios]);

  const scenarios = useMemo(
    () => filterScenarios(filter, roleplays, customScenarios),
    [filter, customScenarios]
  );
  const customCount = scenarios.filter((s) => customIds.has(s.id)).length;

  // Predefined scenarios never depend on the custom-roleplays query, so they render immediately
  // for every filter. Only "all" and "custom" ever include custom scenarios, so the loading
  // status is scoped to those two filters — it never blanks a category filter (life/food/
  // travel/work) that couldn't show custom roleplays anyway.
  const isCustomLoading = customQuery.isLoading;
  const showLoadingStatus = isCustomLoading && (filter === "all" || filter === "custom");
  const showEmptyState = scenarios.length === 0 && !(filter === "custom" && isCustomLoading);

  function handleTutorChange(id: TutorId) {
    const previous = optimisticTutorId;
    setOptimisticTutorId(id);
    if (profileQuery.data?.id) {
      saveUserPreferences(profileQuery.data.id, { tutorId: id });
    } else {
      setOptimisticTutorId(previous);
    }
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    deleteCustomRoleplay.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success("Roleplay deleted");
        setPendingDelete(null);
      },
      onError: () => {
        toast.error("Couldn't delete this roleplay. Please try again.");
      },
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-5 border-b border-line pb-7 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-brand">Practise in context</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">Roleplay</h1>
          <p className="mt-2 max-w-[55ch] text-sm leading-relaxed text-sub">Pick a situation, then build confidence by speaking it through.</p>
        </div>

        <Link
          href="/app/roleplay/new"
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-ink px-5 text-sm font-semibold text-cream transition-[background-color,transform] hover:bg-ink/90 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand md:self-auto"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Create custom roleplay
        </Link>
      </header>

      <section className="mt-8 rounded-[1.75rem] border border-line bg-surface p-5 sm:p-7" aria-labelledby="tutor-heading">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xs">
            <h2 id="tutor-heading" className="font-display text-xl text-ink">Choose your tutor</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-sub">Your tutor stays with you across every scenario.</p>
          </div>
          <TutorPicker value={tutorId} onChange={handleTutorChange} />
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter roleplays">
        {FILTERS.map(({ id, label }) => {
          const active = filter === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(id)}
              className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand ${
                active ? "border-ink bg-ink text-cream" : "border-line bg-surface text-sub hover:border-sub/40"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-sub">
        {scenarios.length} scenario{scenarios.length === 1 ? "" : "s"} available
        {customCount > 0 && <span className="font-semibold text-accent-brand"> ({customCount} custom)</span>}
      </p>

      {showLoadingStatus && (
        <p role="status" className="mt-2 text-sm text-sub">
          Loading custom roleplays…
        </p>
      )}

      {scenarios.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {scenarios.map((scenario) => {
            const isCustom = customIds.has(scenario.id);
            const href = isCustom
              ? `/app/conversation?custom=${scenario.id}&tutor=${tutorId}`
              : `/app/conversation?roleplay=${scenario.id}&tutor=${tutorId}`;
            return (
              <RoleplayCard
                key={scenario.id}
                scenario={scenario}
                href={href}
                isCustom={isCustom}
                onDelete={isCustom ? () => setPendingDelete(scenario) : undefined}
              />
            );
          })}
        </div>
      ) : showEmptyState ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <p className="font-display text-2xl text-ink">No scenarios found</p>
          <p className="mt-2 max-w-sm text-sm text-sub">
            No roleplay scenarios available in this category.
            {filter === "all" && ' Tap "Create custom roleplay" to add your own!'}
          </p>
        </div>
      ) : null}

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="border-line bg-surface text-ink sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-normal text-ink">Delete roleplay?</DialogTitle>
            <DialogDescription className="text-sm text-sub">
              This will permanently remove &ldquo;{pendingDelete?.title}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleteCustomRoleplay.isPending}
              aria-busy={deleteCustomRoleplay.isPending || undefined}
              className="rounded-full bg-hot px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-hot/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleteCustomRoleplay.isPending ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
