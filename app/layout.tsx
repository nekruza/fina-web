import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { MixpanelInit } from "@/components/MixpanelInit";
import { Analytics } from "@vercel/analytics/next"
import { SITE_URL } from "@/lib/site";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  // Optical sizing for large display type, and the SOFT axis used by .fina-display.
  axes: ["opsz", "SOFT"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Fina — Speak English with confidence",
    template: "%s | Fina",
  },
  description:
    "Practice speaking English out loud with Fina's AI tutors. Roleplays, vocabulary, feedback and a 30-day plan, with more languages available.",
  keywords: [
    "English learning app",
    "AI English tutor",
    "practice speaking English",
    "AI conversation practice",
    "English roleplay practice",
    "English vocabulary flashcards",
    "learn English online",
    "30 day English plan",
    "AI English coach",
    "English speaking practice app",
  ],
  authors: [{ name: "Fina Team", url: SITE_URL }],
  creator: "Fina",
  publisher: "Fina",
  category: "Education",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Fina",
    title: "Fina — Speak English with confidence",
    description:
      "Practice speaking English out loud with Fina's AI tutors. Roleplays, vocabulary, feedback and a 30-day plan.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Fina — practice English out loud with AI tutors",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@finaapp",
    creator: "@finaapp",
    title: "Fina — Speak English with confidence",
    description:
      "Practice speaking English out loud with Fina's AI tutors. Roleplays, vocabulary, feedback and a 30-day plan.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to external origins for faster resource loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${fraunces.variable} ${manrope.variable} font-sans antialiased bg-cream text-ink`}
        suppressHydrationWarning
      >
        {/* Skip-to-content for accessibility and SEO */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-ink focus:font-bold focus:rounded-lg focus:shadow-lg"
        >
          Skip to main content
        </a>
        <MixpanelInit />
        <Analytics />
        {children}
      </body>
    </html>
  );
}
