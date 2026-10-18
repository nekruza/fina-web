"use client";

import { FC } from "react";
import { AlertTriangle, Mic, MicOff } from "lucide-react";
import { ACCENT_BUTTON_STYLE } from "./callTheme";

export const MicDeniedBanner: FC<{ message: string | null }> = ({ message }) => (
  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/25 mb-1">
    <MicOff className="w-4 h-4 text-red-400 shrink-0" aria-hidden />
    <p className="text-xs text-red-300 flex-1">
      {message ?? "Microphone access denied — allow it in your browser settings."}
    </p>
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="text-xs text-red-300 underline underline-offset-2 hover:text-red-200 shrink-0"
    >
      Retry
    </button>
  </div>
);

export const SpeechErrorBanner: FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/25 mb-1">
    <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" aria-hidden />
    <p className="text-xs text-amber-200">{message}</p>
  </div>
);

interface GoalReachedBannerProps {
  minutes: number;
  onKeepTalking: () => void;
  onFinish: () => void;
}

/** Non-blocking notice once the session passes the learner's daily goal. */
export const GoalReachedBanner: FC<GoalReachedBannerProps> = ({ minutes, onKeepTalking, onFinish }) => (
  <div
    role="status"
    className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4ade80]/10 border border-[#4ade80]/25"
  >
    <p className="flex-1 min-w-[12rem] text-sm text-white/90">
      {`🎉 You reached your ${minutes}-minute goal!`}
    </p>
    <button
      type="button"
      onClick={onKeepTalking}
      className="h-8 rounded-full px-3 text-xs font-semibold text-white/80 border border-white/15 hover:bg-white/5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
    >
      Keep talking
    </button>
    <button
      type="button"
      onClick={onFinish}
      className="h-8 rounded-full px-3 text-xs font-semibold transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      style={ACCENT_BUTTON_STYLE}
    >
      Finish
    </button>
  </div>
);

export const SendReplyButton: FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Send spoken reply"
    className="flex items-center gap-2 px-5 py-2 rounded-full font-semibold text-sm transition hover:opacity-90 motion-safe:active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    style={ACCENT_BUTTON_STYLE}
  >
    <Mic className="w-4 h-4" aria-hidden />
    Send
  </button>
);
