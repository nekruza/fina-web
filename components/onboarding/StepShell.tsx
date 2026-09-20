import Image from "next/image";
import { getTutorById } from "@/lib/tutors";
import { ProgressDots } from "./ProgressDots";

/**
 * Chat-header shell shared by the four tutor-led assessment steps
 * (language, level, motivation, goal): tutor avatar + "online" status,
 * progress dots, an optional back button, scrollable bubble/option
 * content, and a sticky primary-button footer. Ported from fina's
 * `components/onboarding/OnboardingShared.tsx` `ChatHeader`.
 */
export function StepShell({
  tutorId,
  step,
  total,
  onBack,
  children,
  footer,
}: {
  tutorId: string;
  step: number;
  total: number;
  onBack?: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const tutor = getTutorById(tutorId);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-cream">
      <div className="px-5 pb-3 pt-8 sm:pt-12">
        <div className="mb-3 flex items-center gap-2.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back"
              className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:border-ink/40"
            >
              <span aria-hidden className="text-base leading-none">
                ‹
              </span>
            </button>
          )}
          <div className="flex-1">
            <ProgressDots step={step} total={total} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="relative block h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border-2 border-surface shadow-sm">
            <Image src={tutor.image} alt="" fill sizes="44px" className="object-cover" />
            <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-cream bg-emerald-500" />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-ink">{tutor.name}</p>
            <p className="text-xs text-sub">Your AI tutor · online</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-32 pt-3">{children}</div>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 px-5 pt-3 backdrop-blur-sm"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {footer}
      </div>
    </div>
  );
}
