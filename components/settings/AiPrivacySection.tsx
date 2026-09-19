import Link from "next/link";
import { AI_SERVICES } from "@/lib/data/onboarding";

export function AiPrivacySection() {
  return (
    <section id="ai-privacy" className="scroll-mt-24 rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-brand">Transparency</p>
        <h2 className="mt-2 font-display text-xl text-ink">AI &amp; privacy</h2>
        <p className="mt-2 text-sm leading-6 text-sub">
          Fina uses third-party AI services for conversation practice, vocabulary generation, and analysis. Here&apos;s
          what each service receives and why.
        </p>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {AI_SERVICES.map((service) => (
          <article key={service.name} className="rounded-xl border border-line bg-cream/45 p-5">
            <h3 className="text-base font-semibold text-ink">{service.name}</h3>
            <p className="mt-1 text-xs text-sub">{service.operator}</p>

            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-[88px_minmax(0,1fr)]">
              <dt className="font-semibold text-sub">Data sent</dt>
              <dd className="min-w-0 text-ink">{service.dataSent}</dd>
              <dt className="font-semibold text-sub">Purpose</dt>
              <dd className="min-w-0 text-ink">{service.purpose}</dd>
            </dl>
          </article>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-xl bg-accent-soft p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-5 text-ink">
          Your data is used solely to provide these features. It is not sold or used for advertising.
        </p>
        <Link
          href="/privacy"
          className="shrink-0 text-sm font-semibold text-accent-brand underline underline-offset-2 hover:text-accent-brand/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
        >
          View Privacy Policy
        </Link>
      </div>
    </section>
  );
}
