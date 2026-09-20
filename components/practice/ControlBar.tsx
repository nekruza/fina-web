"use client";

import { FC } from "react";
import {
  Subtitles,
  Lightbulb,
  Square,
  FileText,
  Video,
  VideoOff,
  StopCircle,
  MessageSquare,
} from "lucide-react";

interface ControlBarProps {
  onToggleCaptions: () => void;
  captionsOn: boolean;
  onHint: () => void;
  hintLoading: boolean;
  onToggleCamera: () => void;
  cameraOn: boolean;
  onStop: () => void;
  onToggleNotes: () => void;
  notesOpen: boolean;
  onToggleTypedInput: () => void;
  typedInputOpen: boolean;
  typedInputDisabled?: boolean;
  onInterrupt?: () => void;
  isAISpeaking?: boolean;
}

interface ControlButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  /** Set for on/off toggles so assistive tech hears the state. */
  pressed?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

const ControlButton: FC<ControlButtonProps> = ({
  icon,
  label,
  onClick,
  active,
  pressed,
  danger,
  disabled,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    aria-pressed={pressed}
    className="group relative flex shrink-0 items-center justify-center w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full transition-all duration-200 motion-safe:hover:scale-110 motion-safe:active:scale-95 disabled:opacity-40 disabled:hover:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
    style={{
      background: danger
        ? "rgba(239, 68, 68, 0.9)"
        : active
          ? "rgba(74, 222, 128, 0.18)"
          : "rgba(255, 255, 255, 0.1)",
      border: active ? "1px solid rgba(74, 222, 128, 0.4)" : "1px solid rgba(255, 255, 255, 0.1)",
    }}
  >
    {icon}
    <span
      aria-hidden
      className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-black/80 text-white text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none"
    >
      {label}
    </span>
  </button>
);

const iconClass = "w-4 h-4 md:w-5 md:h-5";

export const ControlBar: FC<ControlBarProps> = ({
  onToggleCaptions,
  captionsOn,
  onHint,
  hintLoading,
  onToggleCamera,
  cameraOn,
  onStop,
  onToggleNotes,
  notesOpen,
  onToggleTypedInput,
  typedInputOpen,
  typedInputDisabled,
  onInterrupt,
  isAISpeaking,
}) => (
  <div className="flex max-w-full items-center justify-center gap-1.5 sm:gap-2 md:gap-3 px-2 sm:px-3 md:px-6 py-2 md:py-3 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10">
    <ControlButton
      icon={<FileText className={`${iconClass} text-white/80`} aria-hidden />}
      label="Notes"
      onClick={onToggleNotes}
      active={notesOpen}
      pressed={notesOpen}
    />
    <ControlButton
      icon={<Subtitles className={`${iconClass} text-white/80`} aria-hidden />}
      label="Captions"
      onClick={onToggleCaptions}
      active={captionsOn}
      pressed={captionsOn}
    />
    <ControlButton
      icon={
        <Lightbulb
          className={iconClass}
          style={{ color: hintLoading ? "#4ade80" : "rgba(255,255,255,0.8)" }}
          aria-hidden
        />
      }
      label="Get Hint"
      onClick={onHint}
      disabled={hintLoading}
    />
    <ControlButton
      icon={
        cameraOn ? (
          <Video className={`${iconClass} text-white/80`} aria-hidden />
        ) : (
          <VideoOff className={`${iconClass} text-white/80`} aria-hidden />
        )
      }
      label="Camera"
      onClick={onToggleCamera}
      active={cameraOn}
      pressed={cameraOn}
    />
    <ControlButton
      icon={<MessageSquare className={`${iconClass} text-white/80`} aria-hidden />}
      label="Type a message"
      onClick={onToggleTypedInput}
      active={typedInputOpen}
      pressed={typedInputOpen}
      disabled={typedInputDisabled}
    />
    {isAISpeaking && onInterrupt && (
      <ControlButton
        icon={<StopCircle className={`${iconClass} text-white`} aria-hidden />}
        label="Interrupt"
        onClick={onInterrupt}
        danger
      />
    )}
    <ControlButton
      icon={<Square className={`${iconClass} text-white`} aria-hidden />}
      label="End Session"
      onClick={onStop}
      danger
    />
  </div>
);
