import type { Metadata } from "next";
import Link from "next/link";
import {
  ExternalLink,
  LegalDocument,
  LegalList,
  LegalSection,
  Provider,
  ProviderRow,
} from "@/components/LegalDocument";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Fina collects, uses and protects your data, which AI and web services process it, and how to reach us. We do not sell your data.",
  alternates: { canonical: "/privacy" },
};

// Text ported from the Fina mobile app (fina/app/privacy-policy.tsx), plus the
// "Using Fina on the Web" section for web-only services.
export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy" updated="October 2025" updatedIso="2025-10">
      <LegalSection title="Introduction">
        <p>
          Welcome to Fina (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your
          privacy and ensuring transparency about how we collect, use, and protect your personal information. This
          Privacy Policy explains how we handle your data when you use our vocabulary learning application.
        </p>
      </LegalSection>

      <LegalSection title="Information We Collect">
        <p>We collect the following types of information:</p>
        <LegalList>
          <li>
            <strong className="font-semibold text-ink">Account Information:</strong> Email address, display name, and
            authentication credentials
          </li>
          <li>
            <strong className="font-semibold text-ink">Learning Progress:</strong> Words learned, lesson completion,
            favorites, streaks, and accuracy data
          </li>
          <li>
            <strong className="font-semibold text-ink">Voice Data:</strong> Audio recordings when you use voice
            conversation features (processed temporarily and not stored permanently)
          </li>
          <li>
            <strong className="font-semibold text-ink">User-Generated Content:</strong> Custom vocabulary topics,
            feedback, and custom roleplay scenarios
          </li>
          <li>
            <strong className="font-semibold text-ink">Device Information:</strong> Device type, operating system, and
            app version for technical support
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="How We Use Your Information">
        <p>We use your information to:</p>
        <LegalList>
          <li>Provide and improve our vocabulary learning services</li>
          <li>Track your learning progress and personalize your experience</li>
          <li>Generate AI-powered vocabulary lessons and conversations</li>
          <li>Authenticate your account and maintain security</li>
          <li>Respond to your feedback and support requests</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Third-Party AI Services & Data Sharing">
        <p>
          Fina uses third-party AI services to deliver its core vocabulary learning features. This section identifies
          what data is sent, who receives it, and how it is used.
        </p>

        <aside aria-label="Required disclosure" className="rounded-[20px] border border-hot/30 bg-hot/5 p-5">
          <p className="text-[14px] font-semibold text-ink">
            Required Disclosure (App Store Guidelines 5.1.1(i) and 5.1.2(i))
          </p>
          <p className="mt-2 text-[15px]">
            Review this information before using Fina&apos;s AI-powered features so you understand what data is shared
            with third-party AI providers and how it is used.
          </p>
        </aside>

        <div className="space-y-3">
          <Provider name="Google Gemini (gemini-2.5-flash-lite)">
            <ProviderRow term="Who">Google LLC</ProviderRow>
            <ProviderRow term="What data is sent">
              Your typed messages, conversation text, selected language, proficiency level, and custom vocabulary
              topics.
            </ProviderRow>
            <ProviderRow term="Purpose">
              Generate personalized vocabulary lessons, lesson content, and conversation responses.
            </ProviderRow>
            <ProviderRow term="Privacy Policy">
              <ExternalLink href="https://policies.google.com/privacy" />
            </ProviderRow>
            <ProviderRow term="Data Protection">
              Google provides the same or equal data protection as described in this privacy policy.
            </ProviderRow>
          </Provider>

          <Provider name="Inworld AI">
            <ProviderRow term="Who">Inworld AI</ProviderRow>
            <ProviderRow term="What data is sent">
              Words and phrases to be converted to speech, and your voice audio during real-time conversations.
            </ProviderRow>
            <ProviderRow term="Purpose">
              Generate realistic voice pronunciations, audio hints, and real-time voice conversation. Audio is processed
              in real-time and not stored permanently.
            </ProviderRow>
            <ProviderRow term="Privacy Policy">
              <ExternalLink href="https://www.inworld.ai/privacy-policy" />
            </ProviderRow>
            <ProviderRow term="Data Protection">
              Inworld provides the same or equal data protection as described in this privacy policy.
            </ProviderRow>
          </Provider>

          <Provider name="Supabase (Backend Infrastructure)">
            <ProviderRow term="Who">Supabase Inc.</ProviderRow>
            <ProviderRow term="What data is stored">
              Your account information, learning progress, app settings, and user preferences.
            </ProviderRow>
            <ProviderRow term="Purpose">Securely store and manage your app data.</ProviderRow>
            <ProviderRow term="Privacy Policy">
              <ExternalLink href="https://supabase.com/privacy" />
            </ProviderRow>
            <ProviderRow term="Data Protection">
              Supabase provides the same or equal data protection as described in this privacy policy.
            </ProviderRow>
          </Provider>
        </div>

        <p>
          You can opt out of AI-powered features at any time by contacting us or deleting your account. Each AI provider
          operates under its own privacy policy. We encourage you to review them.
        </p>
        <p>
          <strong className="font-semibold text-ink">Data Protection Guarantee:</strong> All third-party AI providers
          listed above have confirmed they provide the same or equal protection of user data as described in this
          privacy policy. We do not sell your data to any third party. Data shared with AI services is used solely for
          generating your in-app learning content.
        </p>
      </LegalSection>

      <LegalSection title="Data Retention">
        <p>
          We retain your account and learning progress data for as long as your account is active. Voice recordings are
          processed in real-time and are not stored permanently. If you delete your account, your data will be removed
          from our systems.
        </p>
      </LegalSection>

      <LegalSection title="Your Rights">
        <p>You have the right to:</p>
        <LegalList>
          <li>Access your personal information</li>
          <li>Correct inaccurate information</li>
          <li>Request deletion of your account and data</li>
          <li>Opt out of optional features like voice conversation</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Data Security">
        <p>
          We implement industry-standard security measures to protect your data, including encryption, secure
          authentication, and row-level security policies in our database. However, no method of transmission over the
          internet is 100% secure.
        </p>
      </LegalSection>

      <LegalSection title="Children's Privacy">
        <p>
          Fina is not intended for children under 13 years of age. We do not knowingly collect personal information from
          children under 13. If you believe we have collected information from a child under 13, please contact us
          immediately.
        </p>
      </LegalSection>

      <LegalSection title="Using Fina on the Web">
        <p>
          Everything above also applies when you use Fina in a web browser. The web version additionally uses the
          services below.
        </p>

        <div className="space-y-3">
          <Provider name="Stripe (Payments)">
            <ProviderRow term="Who">Stripe, Inc.</ProviderRow>
            <ProviderRow term="What data is processed">
              Your payment card details, billing email and billing address details when you subscribe to Fina Pro on the
              web. Stripe collects card details directly; we never see or store them. We store only your Stripe customer
              ID, subscription ID and subscription status.
            </ProviderRow>
            <ProviderRow term="Purpose">
              Process web subscription payments, renewals and cancellations, and provide the billing portal.
            </ProviderRow>
            <ProviderRow term="Privacy Policy">
              <ExternalLink href="https://stripe.com/privacy" />
            </ProviderRow>
          </Provider>

          <Provider name="Vercel (Hosting and Web Analytics)">
            <ProviderRow term="Who">Vercel Inc.</ProviderRow>
            <ProviderRow term="What data is processed">
              Standard request data such as IP address, browser and device type, and the pages you visit.
            </ProviderRow>
            <ProviderRow term="Purpose">
              Host the Fina website and measure page visits in aggregate. Vercel Web Analytics does not use cookies.
            </ProviderRow>
            <ProviderRow term="Privacy Policy">
              <ExternalLink href="https://vercel.com/legal/privacy-policy" />
            </ProviderRow>
          </Provider>

          <Provider name="Mixpanel (Product Analytics)">
            <ProviderRow term="Who">Mixpanel, Inc.</ProviderRow>
            <ProviderRow term="What data is processed">
              Your account ID and email once you sign in, the features you use and actions you take in the web app,
              device and browser information, and session replays (a reconstruction of the pages you see and what you
              click) of web sessions.
            </ProviderRow>
            <ProviderRow term="Purpose">
              Understand how Fina is used, find and fix problems, and improve the product. Fina&apos;s Mixpanel data is
              processed through Mixpanel&apos;s EU data residency service.
            </ProviderRow>
            <ProviderRow term="Privacy Policy">
              <ExternalLink href="https://mixpanel.com/legal/privacy-policy" />
            </ProviderRow>
          </Provider>

          <Provider name="OpenAI (Backup AI Provider)">
            <ProviderRow term="Who">OpenAI</ProviderRow>
            <ProviderRow term="What data is sent">
              The same conversation text described for Google Gemini above, only when Gemini is unavailable.
            </ProviderRow>
            <ProviderRow term="Purpose">
              Keep conversation replies, vocabulary generation and conversation analysis working if Gemini fails.
            </ProviderRow>
            <ProviderRow term="Privacy Policy">
              <ExternalLink href="https://openai.com/policies/privacy-policy" />
            </ProviderRow>
          </Provider>
        </div>

        <p>
          <strong className="font-semibold text-ink">Speech recognition:</strong> Voice conversations on the web use your
          browser&apos;s built-in speech recognition to turn what you say into text. In Chrome and Edge this service is
          provided by Google and Microsoft respectively, under their own privacy policies.
        </p>
        <p>
          <strong className="font-semibold text-ink">Cookies and local storage:</strong> We use cookies to keep you
          signed in. The web app stores your onboarding answers and study-plan progress in your browser&apos;s local
          storage, and Mixpanel uses cookies or local storage to recognize your device.
        </p>
        <p>
          <strong className="font-semibold text-ink">Deleting your data:</strong> You can delete your account and its
          data at any time from Settings in the web app. See also our <Link href="/terms" className="font-medium text-accent-brand underline decoration-accent-brand/40 underline-offset-4 hover:decoration-accent-brand">Terms of Service</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Changes to This Privacy Policy">
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new
          Privacy Policy in the app and updating the &quot;Last Updated&quot; date.
        </p>
      </LegalSection>

      <LegalSection title="Contact Us">
        <p>If you have any questions about this Privacy Policy or how we handle your data, please contact us:</p>
        <p>
          Email:{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-accent-brand underline decoration-accent-brand/40 underline-offset-4 hover:decoration-accent-brand"
          >
            {CONTACT_EMAIL}
          </a>
          <br />
          Mobile app: Use the Feedback section in Profile settings.
          <br />
          Web: Use &quot;Give us feedback&quot; on your dashboard.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
