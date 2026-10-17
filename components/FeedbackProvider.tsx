"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { CheckCircle } from "lucide-react";

/**
 * App-wide feedback dialog. Moved out of `AppSidebar` so the home screen's
 * "Give us feedback" quick action can open the same dialog instance instead
 * of duplicating the form. Same fields, labels, and `feedback` table insert
 * as the original sidebar implementation.
 */

const FEEDBACK_TYPES = [
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "improvement", label: "Improvement" },
  { value: "compliment", label: "Compliment" },
] as const;

type FeedbackType = (typeof FEEDBACK_TYPES)[number]["value"];

interface FeedbackDialogContextValue {
  open: () => void;
}

const FeedbackDialogContext = createContext<FeedbackDialogContextValue | null>(null);

export function useFeedbackDialog(): FeedbackDialogContextValue {
  const ctx = useContext(FeedbackDialogContext);
  if (!ctx) {
    throw new Error("useFeedbackDialog must be used within a FeedbackProvider");
  }
  return ctx;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("improvement");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  function openFeedback() {
    setFeedbackSubmitted(false);
    setFeedbackMessage("");
    setFeedbackType("improvement");
    setFeedbackOpen(true);
  }

  async function submitFeedback() {
    if (!feedbackMessage.trim()) return;
    setFeedbackSubmitting(true);
    try {
      // Loaded on demand so supabase-js stays out of the app shell's first-load JS.
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("feedback").insert({
        type: feedbackType,
        message: feedbackMessage.trim(),
        user_id: user?.id ?? null,
        user_email: user?.email ?? null,
      });
      setFeedbackSubmitted(true);
    } catch {
      // silent fail — the dialog stays open with the composed message intact
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  return (
    <FeedbackDialogContext.Provider value={{ open: openFeedback }}>
      {children}

      {feedbackOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(27,26,23,0.45)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setFeedbackOpen(false);
          }}
        >
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md shadow-2xl border border-line">
            {feedbackSubmitted ? (
              <div className="text-center py-6 space-y-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto"
                  style={{ background: "var(--fina-accent-soft)" }}
                >
                  <CheckCircle className="w-6 h-6" style={{ color: "#2E5E3E" }} />
                </div>
                <p className="font-bold text-ink text-lg">Thanks for your feedback</p>
                <p className="text-sm text-sub">We read every submission and use it to improve Fina.</p>
                <button
                  onClick={() => setFeedbackOpen(false)}
                  className="mt-2 px-5 py-2 rounded-xl text-sm font-semibold border border-line text-ink hover:bg-cream transition"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-ink font-display">Share your feedback</h2>
                  <button
                    onClick={() => setFeedbackOpen(false)}
                    className="text-sub hover:text-ink transition text-xl leading-none w-7 h-7 flex items-center justify-center rounded-lg hover:bg-cream"
                  >
                    &times;
                  </button>
                </div>

                {/* Type */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-sub uppercase tracking-widest mb-2">Type</p>
                  <div className="flex flex-wrap gap-2">
                    {FEEDBACK_TYPES.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setFeedbackType(value)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                        style={
                          feedbackType === value
                            ? { border: "1.5px solid #2E5E3E", background: "var(--fina-accent-soft)", color: "#1B1A17" }
                            : { border: "1.5px solid var(--fina-line)", background: "transparent", color: "var(--fina-sub)" }
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div className="mb-5">
                  <p className="text-xs font-semibold text-sub uppercase tracking-widest mb-2">Message</p>
                  <textarea
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder="Tell us what you think, what's broken, or what you'd love to see..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-line text-sm text-ink placeholder:text-sub/60 focus:outline-none focus:border-[#2E5E3E] focus:ring-1 focus:ring-[#2E5E3E] transition resize-none bg-cream"
                  />
                </div>

                <button
                  onClick={submitFeedback}
                  disabled={feedbackSubmitting || !feedbackMessage.trim()}
                  className="w-full py-2.5 rounded-xl font-bold text-sm transition-all hover:brightness-110 disabled:opacity-40"
                  style={{ background: "#2E5E3E", color: "#ffffff" }}
                >
                  {feedbackSubmitting ? "Submitting…" : "Submit feedback"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </FeedbackDialogContext.Provider>
  );
}
