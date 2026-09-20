import Link from "next/link";
import Image from "next/image";
import { TUTORS } from "@/lib/tutors";

const TRIO = TUTORS; // luna, henry, jake — lib/tutors.ts order

const BENEFITS = [
  "Real voice conversations with an AI tutor — not flashcards.",
  "A personalized 30-day plan matched to your goal and level.",
  "10 minutes a day is enough. Speak from day one.",
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-cream">
      {/* ── Left brand panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col bg-surface border-r border-line px-10 py-10 xl:px-14 xl:py-14">
        <Link href="/" className="flex w-fit items-center gap-2.5">
          <Image src="/logo.png" alt="Fina" width={34} height={34} className="rounded-lg" />
          <span className="text-lg font-bold text-ink">Fina</span>
        </Link>

        <div className="flex flex-1 flex-col justify-center gap-8 -mt-10">
          <div>
            {/* Tutor trio */}
            <div className="mb-8 flex">
              {TRIO.map((tutor, i) => (
                <span
                  key={tutor.id}
                  className="relative block h-20 w-20 overflow-hidden rounded-full border-4 border-surface shadow-md"
                  style={{ marginLeft: i === 0 ? 0 : -20, zIndex: TRIO.length - i, transform: i === 1 ? "translateY(-6px)" : undefined }}
                >
                  <Image src={tutor.image} alt={tutor.name} fill sizes="80px" className="object-cover" />
                </span>
              ))}
            </div>

            <h2 className="mb-4 font-display text-[2.6rem] font-bold leading-[1.1] text-ink">
              Build confidence
              <br />
              through conversation.
            </h2>
            <p className="max-w-[300px] text-sm leading-relaxed text-sub">
              Meet Henry, Jake &amp; Luna — AI tutors who&apos;ll have real conversations with you, at your level, on
              your schedule.
            </p>
          </div>

          {/* Three benefits */}
          <div className="rounded-2xl border border-line bg-cream p-5">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-sub">Why Fina</p>
            <div className="space-y-3">
              {BENEFITS.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-accent-brand/40 bg-accent-soft">
                    <svg width="8" height="8" viewBox="0 0 9 9" fill="none">
                      <path
                        d="M1.5 4.5l2 2 4-4"
                        stroke="#2E5E3E"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="text-xs leading-relaxed text-ink">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-12">
        <div className="mb-8 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Fina" width={34} height={34} className="rounded-lg" />
            <span className="text-xl font-bold text-ink">Fina</span>
          </Link>
        </div>
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}
