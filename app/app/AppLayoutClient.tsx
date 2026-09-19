"use client";

import { useEffect } from "react";
import { QueryProvider } from "@/components/QueryProvider";
import { AppSidebar } from "./AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { FeedbackProvider } from "@/components/FeedbackProvider";
import { identify } from "@/lib/mixpanel";

interface AppLayoutClientProps {
  children: React.ReactNode;
  userId: string | null;
  userEmail: string | null;
  avatarUrl: string | null;
}

export function AppLayoutClient({ children, userId, userEmail, avatarUrl }: AppLayoutClientProps) {
  useEffect(() => {
    if (userId && userEmail) {
      identify(userId, userEmail);
    }
  }, [userId, userEmail]);

  return (
    <QueryProvider>
      <FeedbackProvider>
        <a
          href="#main-content"
          className="sr-only z-[100] rounded-md bg-ink px-4 py-2 text-sm font-semibold text-cream focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <AppSidebar userEmail={userEmail} avatarUrl={avatarUrl} />
        <main id="main-content" className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1440px] px-5 pb-28 pt-6 sm:px-8 sm:pt-8 md:px-10 md:pb-10 lg:px-12 lg:pt-10">{children}</div>
        </main>
        <Toaster position="top-right" />
        {/* Hidden audio element for Inworld Realtime agent voice playback */}
        <audio id="inworld-agent-audio" autoPlay playsInline style={{ display: "none" }} />
      </FeedbackProvider>
    </QueryProvider>
  );
}
