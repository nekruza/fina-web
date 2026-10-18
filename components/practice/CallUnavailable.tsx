"use client";

import { FC } from "react";
import { AlertTriangle } from "lucide-react";
import { ACCENT_BUTTON_STYLE } from "./callTheme";

interface CallUnavailableProps {
  /** "connection": the tutor session failed to start. "unsupported": no speech recognition in this browser. */
  reason: "connection" | "unsupported";
  tutorName: string;
  onBack: () => void;
}

/** Full-screen fallback shown instead of the call when it cannot run. */
export const CallUnavailable: FC<CallUnavailableProps> = ({ reason, tutorName, onBack }) => {
  const connectionFailed = reason === "connection";
  return (
    <div className="fixed inset-0 z-50 bg-[#0a0d14] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <AlertTriangle className="w-12 h-12 text-amber-300 mx-auto mb-4" aria-hidden />
        <h2 className="font-display text-2xl text-white mb-2">
          {connectionFailed ? "Couldn’t connect to your tutor" : "Voice practice needs Chrome or Edge"}
        </h2>
        <p className="text-white/60 mb-6">
          {connectionFailed
            ? "Check your connection, then go back and start the conversation again."
            : `This browser can’t recognise speech yet. Open Fina in Chrome or Edge to talk with ${tutorName}.`}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2.5 rounded-full font-semibold text-sm transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
          style={ACCENT_BUTTON_STYLE}
        >
          Go back
        </button>
      </div>
    </div>
  );
};
