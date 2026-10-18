"use client";

import { FC } from "react";
import { ACCENT_BUTTON_STYLE } from "./callTheme";

interface EndCallDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export const EndCallDialog: FC<EndCallDialogProps> = ({ onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-conversation-title"
      aria-describedby="end-conversation-body"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      className="bg-[#111723] border border-white/10 rounded-3xl p-7 max-w-sm w-full shadow-2xl"
    >
      <h3 id="end-conversation-title" className="font-display text-2xl text-white mb-2">
        End conversation
      </h3>
      <p id="end-conversation-body" className="text-sm text-white/60 mb-6">
        Your conversation will be saved and analysed.
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-full text-sm font-medium border border-white/20 text-white/70 hover:bg-white/5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 py-2.5 rounded-full text-sm font-semibold transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          style={ACCENT_BUTTON_STYLE}
        >
          Complete
        </button>
      </div>
    </div>
  </div>
);
