import type { ReactNode } from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { frauncesSoft } from "@/lib/marketing-font";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Page frame for /privacy and /terms: semantic article, one h1, h2 sections. */
export function LegalDocument({
  title,
  updated,
  updatedIso,
  children,
}: {
  title: string;
  updated: string;
  updatedIso: string;
  children: ReactNode;
}) {
  return (
    // `contents` keeps this wrapper out of layout; it only scopes the SOFT font variable.
    <div className={`contents ${frauncesSoft.variable}`}>
      <Navigation />
      <main id="main-content" className="bg-cream px-4 pb-24 pt-32 sm:px-6 md:pt-40">
        <article className="mx-auto max-w-[68ch] text-ink">
          <header className="border-b border-line pb-10">
            <h1 className="font-display fina-display text-[clamp(2.5rem,6vw,4rem)] font-medium leading-[1.05] tracking-[-0.025em]">
              {title}
            </h1>
            <p className="mt-4 text-sm text-sub">
              Last Updated: <time dateTime={updatedIso}>{updated}</time>
            </p>
          </header>
          <div className="mt-12">{children}</div>
        </article>
      </main>
      <Footer />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  const id = slugify(title);
  return (
    <section aria-labelledby={id} className="mt-14 scroll-mt-24 first:mt-0">
      <h2 id={id} className="font-display fina-display text-[1.75rem] font-medium leading-tight tracking-[-0.015em] text-ink">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[16px] leading-[1.7] text-ink/85">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-sub">{children}</ul>;
}

/** One third-party provider entry (name + Who / What / Purpose / Policy / Protection). */
export function Provider({ name, children }: { name: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-line bg-surface p-5">
      <h3 className="text-[16px] font-semibold text-ink">{name}</h3>
      <dl className="mt-3 grid gap-x-4 gap-y-2 text-[15px] leading-relaxed sm:grid-cols-[9.5rem_minmax(0,1fr)]">
        {children}
      </dl>
    </div>
  );
}

export function ProviderRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-semibold text-ink">{term}</dt>
      <dd className="text-ink/80 [overflow-wrap:anywhere]">{children}</dd>
    </>
  );
}

export function ExternalLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      className="font-medium text-accent-brand underline decoration-accent-brand/40 underline-offset-4 hover:decoration-accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
    >
      {href}
    </a>
  );
}
