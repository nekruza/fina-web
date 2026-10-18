import type { ReactNode } from "react";
import Image from "next/image";
import { TUTORS } from "@/lib/tutors";
import { roleplays } from "@/lib/data/roleplays";
import { sectionHeading, shell } from "./styles";

// Deterministic bar heights for the static waveform in step 2.
const WAVE = [30, 55, 80, 45, 95, 60, 35, 70, 100, 50, 75, 40, 85, 55, 30, 65, 90, 45, 60, 35, 25, 50];

function TutorRoster() {
  return (
    <ul className="space-y-3">
      {TUTORS.map((tutor) => (
        <li key={tutor.id} className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-line">
            <Image src={tutor.image} alt="" width={80} height={80} sizes="40px" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{tutor.name}</p>
            <p className="text-[13px] text-sub">{tutor.blurb.split(" · ").join(", ")}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ScenarioTicket() {
  const scenario = roleplays.find((r) => r.title === "Hotel Check-in");
  if (!scenario) return null;

  return (
    <div className="rounded-[20px] border border-line bg-cream p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{scenario.title}</p>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-brand">
          {scenario.difficulty}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-sub">
        You&apos;re the {scenario.userRole.toLowerCase()}. Your tutor is the {scenario.aiRole.toLowerCase()}.
      </p>
      <div aria-hidden="true" className="mt-4 flex h-8 items-center gap-[3px]">
        {WAVE.map((h, i) => (
          <span key={i} className="w-[3px] rounded-full bg-ink/70" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

function CorrectionNote() {
  return (
    <div className="rounded-[20px] border border-line bg-cream p-4">
      <p lang="en" className="text-sm text-sub line-through decoration-hot decoration-2">
        I am agree.
      </p>
      <p lang="en" className="mt-1 font-display fina-display text-[22px] leading-snug text-ink">
        I agree.
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-sub">
        In English, say <span lang="en">&ldquo;I agree&rdquo;</span>, not <span lang="en">&ldquo;I am agree.&rdquo;</span>
      </p>
    </div>
  );
}

export function HowItWorks() {
  const steps: { title: string; body: string; visual: ReactNode }[] = [
    {
      title: "Choose your English tutor",
      body: "Practice with Luna, Henry or Jake in English, starting from the level you're at today.",
      visual: <TutorRoster />,
    },
    {
      title: "Speak a real scenario out loud",
      body: "Order a coffee, check into a hotel, ask for directions. Your tutor plays the other role and answers in real time.",
      visual: <ScenarioTicket />,
    },
    {
      title: "Get scores and corrections, learn the words",
      body: "When you finish, you see six scores and the corrections that matter. Then you learn the topic's words with flashcards.",
      visual: <CorrectionNote />,
    },
  ];

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="scroll-mt-20 border-y border-line bg-surface px-4 py-20 sm:px-6 md:py-28"
    >
      <div className={shell}>
        <h2 id="how-title" className={`${sectionHeading} fina-reveal max-w-[16ch]`}>
          One conversation at a time.
        </h2>

        <ol className="mt-14 grid gap-14 md:mt-20 md:grid-cols-3 md:gap-8 lg:gap-12">
          {steps.map((step, i) => (
            <li key={step.title} className="fina-reveal flex flex-col border-t border-ink pt-6">
              <span
                aria-hidden="true"
                className="font-display fina-display text-[4.5rem] font-light leading-none tracking-[-0.04em] text-ink"
              >
                {i + 1}
              </span>
              <h3 className="mt-6 text-xl font-semibold tracking-[-0.01em] text-ink">{step.title}</h3>
              <p className="mt-3 max-w-[36ch] text-[16px] leading-relaxed text-sub">{step.body}</p>
              <div className="mt-8">{step.visual}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
