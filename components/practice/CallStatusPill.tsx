"use client";

import { FC } from "react";
import { Mic } from "lucide-react";
import type { ConversationState } from "@/lib/types/conversation";
import { YOUR_TURN } from "./callTheme";

interface CallStatusPillProps {
  state: ConversationState;
  tutorName: string;
}

/** Live-region pill in the call header saying whose turn it is. */
export const CallStatusPill: FC<CallStatusPillProps> = ({ state, tutorName }) => (
  <div
    role="status"
    aria-live="polite"
    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5"
  >
    {state === "listening" && (
      <>
        <Mic className="w-3.5 h-3.5" style={{ color: YOUR_TURN }} aria-hidden />
        <span className="text-xs font-medium" style={{ color: YOUR_TURN }}>
          Your turn
        </span>
      </>
    )}
    {state === "ai_speaking" && (
      <>
        <span className="w-2 h-2 rounded-full bg-white motion-safe:animate-pulse" />
        <span className="text-xs text-white/85 font-medium">{tutorName} is speaking</span>
      </>
    )}
    {state === "processing" && (
      <>
        <span className="w-2 h-2 rounded-full bg-amber-300 motion-safe:animate-pulse" />
        <span className="text-xs text-amber-300 font-medium">{tutorName} is thinking…</span>
      </>
    )}
    {state === "initializing" && (
      <>
        <span className="w-2 h-2 rounded-full bg-white/40 motion-safe:animate-pulse" />
        <span className="text-xs text-white/50 font-medium">Connecting…</span>
      </>
    )}
    {state === "paused" && (
      <>
        <span className="w-2 h-2 rounded-full bg-orange-300" />
        <span className="text-xs text-orange-300 font-medium">Paused</span>
      </>
    )}
  </div>
);
