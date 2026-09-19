import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TUTORS } from "@/lib/tutors";

const PORTRAIT_STYLES = [
  "-rotate-6 translate-y-2",
  "relative z-10 -translate-y-2",
  "rotate-6 translate-y-2",
];

export function TutorWelcomeCard() {
  return (
    <section
      aria-labelledby="tutor-welcome-heading"
      className="mt-7 flex flex-col-reverse items-center gap-7 overflow-hidden rounded-[1.75rem] border border-accent-brand/10 bg-accent-soft px-6 py-7 sm:px-8 lg:flex-row lg:justify-between lg:gap-5"
    >
      <div className="min-w-0 max-w-sm text-center lg:text-left">
        <h2 id="tutor-welcome-heading" className="font-display text-2xl leading-tight text-ink sm:text-3xl">
          A little conversation goes a long way.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-sub">
          Your AI tutors are here to help. Say hello and make a little progress today.
        </p>
        <Link
          href="/app/roleplay"
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-brand/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-brand"
        >
          Let’s talk
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className="flex shrink-0 items-center -space-x-2 px-2 py-3 sm:-space-x-3" aria-label="Meet your tutors">
        {TUTORS.map((tutor, index) => (
          <figure
            key={tutor.id}
            className={`w-[82px] shrink-0 rounded-[1.1rem] border-[3px] border-white bg-white shadow-[0_8px_20px_-10px_rgba(27,26,23,0.3)] sm:w-[92px] xl:w-[118px] ${PORTRAIT_STYLES[index]}`}
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-[0.85rem] bg-line">
              <Image
                src={tutor.image}
                alt=""
                fill
                sizes="(min-width: 1280px) 112px, (min-width: 640px) 86px, 76px"
                className="object-cover"
              />
            </div>
            <figcaption className="py-1.5 text-center text-xs font-semibold text-ink sm:py-2">
              {tutor.name}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
