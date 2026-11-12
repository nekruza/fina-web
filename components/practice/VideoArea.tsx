"use client";

import { FC, useRef, useEffect } from "react";
import Image from "next/image";
import { AudioWaveform } from "./AudioWaveform";
import { Mic } from "lucide-react";
import type { Tutor } from "@/lib/tutors";

interface CaptionData {
  text: string;
  role: "user" | "assistant";
}

interface VideoAreaProps {
  webcamStream: MediaStream | null;
  isAISpeaking: boolean;
  isUserSpeaking: boolean;
  analyserData: Uint8Array;
  userName?: string;
  avatarUrl?: string | null;
  caption?: CaptionData | null;
  tutor: Tutor;
}

const YOUR_TURN = "#4ade80";

export const VideoArea: FC<VideoAreaProps> = ({
  webcamStream,
  isAISpeaking,
  isUserSpeaking,
  analyserData,
  userName = "You",
  avatarUrl,
  caption,
  tutor,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const idleVideoRef = useRef<HTMLVideoElement>(null);
  const speakingVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && webcamStream) {
      videoRef.current.srcObject = webcamStream;
    }
  }, [webcamStream]);

  // Both clips autoplay+loop, but on some browsers a hidden (opacity:0) video
  // gets paused. Force-play the active clip whenever the speaking state flips.
  useEffect(() => {
    const target = isAISpeaking ? speakingVideoRef.current : idleVideoRef.current;
    target?.play().catch(() => {});
  }, [isAISpeaking, tutor.speakingVideo, tutor.idleVideo]);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Tutor accent (hex) with an alpha suffix for the speaking glow.
  const accent = tutor.accent;

  return (
    <div className="relative w-full flex-1 min-h-0 max-h-[65vh] md:max-h-none rounded-3xl overflow-hidden">
      {/* Two-pane layout: tutor on the left, learner on the right */}
      <div className="relative w-full h-full flex flex-col md:flex-row gap-2">
        {/* ── Tutor pane ─────────────────────────────────────────────── */}
        <div
          className="relative flex-1 md:w-1/2 rounded-2xl overflow-hidden bg-black transition-all duration-500"
          style={{
            border: isAISpeaking ? `1px solid ${accent}cc` : "1px solid rgba(255, 255, 255, 0.06)",
            boxShadow: isAISpeaking
              ? `0 0 36px ${accent}66, inset 0 0 60px ${accent}14`
              : "inset 0 0 80px rgba(0,0,0,0.4)",
          }}
        >
          {/* Idle clip — visible when the tutor is silent */}
          <video
            ref={idleVideoRef}
            key={tutor.idleVideo}
            src={tutor.idleVideo}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
            style={{ opacity: isAISpeaking ? 0 : 1 }}
          />
          {/* Speaking clip — visible when the tutor is talking */}
          <video
            ref={speakingVideoRef}
            key={tutor.speakingVideo}
            src={tutor.speakingVideo}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
            style={{ opacity: isAISpeaking ? 1 : 0 }}
          />

          {/* Name tag */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/55 backdrop-blur-sm w-fit">
            <span
              className="w-2 h-2 rounded-full transition-colors duration-500"
              style={{ background: isAISpeaking ? YOUR_TURN : "#6b7280" }}
            />
            <p className="text-xs font-semibold text-white leading-tight">{tutor.name}</p>
          </div>

          {/* Speaking indicator */}
          {isAISpeaking && (
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-white motion-safe:animate-pulse" />
              <span className="text-xs font-medium text-white/90">Speaking</span>
            </div>
          )}
        </div>

        {/* ── Learner pane ───────────────────────────────────────────── */}
        <div
          className="relative flex-1 md:w-1/2 rounded-2xl overflow-hidden bg-gradient-to-br from-[#121826] to-[#0a0d14] transition-all duration-500"
          style={{
            border: isUserSpeaking
              ? "1px solid rgba(74, 222, 128, 0.35)"
              : "1px solid rgba(255, 255, 255, 0.06)",
            boxShadow: isUserSpeaking
              ? "0 0 30px rgba(74, 222, 128, 0.16), inset 0 0 60px rgba(74, 222, 128, 0.04)"
              : "inset 0 0 80px rgba(0,0,0,0.4)",
          }}
        >
          {webcamStream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div
                className={`w-28 h-28 rounded-full flex items-center justify-center text-4xl font-bold transition-shadow duration-500 overflow-hidden ${isUserSpeaking ? "animate-speaking-ring" : ""}`}
                style={{
                  background: avatarUrl ? "transparent" : "linear-gradient(135deg, #4ade80, #2E5E3E)",
                  color: "#0a0d14",
                  boxShadow: isUserSpeaking
                    ? "0 0 40px rgba(74, 222, 128, 0.35)"
                    : "0 0 0 rgba(74, 222, 128, 0)",
                }}
              >
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={userName}
                    width={112}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
            </div>
          )}

          {/* Learner name tag */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/55 backdrop-blur-sm">
            {isUserSpeaking && <Mic className="w-3 h-3" style={{ color: YOUR_TURN }} aria-hidden />}
            <span className="text-xs text-white/80 font-medium">{userName}</span>
          </div>

          {/* Listening indicator (top-right of learner pane) */}
          <div className="absolute top-4 right-4 z-10">
            {isUserSpeaking ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#4ade80]/15 border border-[#4ade80]/25 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-[#4ade80] motion-safe:animate-pulse" />
                <span className="text-xs font-medium text-[#4ade80]">Listening</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-black/30 backdrop-blur-sm" aria-hidden>
                {[0.9, 1, 0.8, 0.95, 0.7].map((opacity, i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-white transition-opacity duration-300"
                    style={{ opacity }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Learner audio waveform (only when no webcam) */}
          {!webcamStream && isUserSpeaking && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
              <AudioWaveform
                analyserData={analyserData}
                isActive={isUserSpeaking}
                variant="user"
                barCount={12}
                className="h-8"
              />
            </div>
          )}
        </div>
      </div>

      {/* Caption overlay — spans full width at bottom. The wrapper ignores
          pointer events so it never blocks the video; the box takes them back
          so learners can select and copy the caption text. */}
      {caption?.text && (
        <div className="absolute bottom-4 left-4 right-4 z-20 flex justify-center pointer-events-none">
          <div
            data-testid="video-caption"
            className="max-w-2xl w-full px-5 py-3 rounded-2xl text-center pointer-events-auto select-text cursor-text"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(14px)" }}
          >
            <p
              className="text-[9px] font-bold uppercase tracking-widest mb-1.5 select-none"
              style={{ color: caption.role === "user" ? YOUR_TURN : "rgba(255,255,255,0.45)" }}
            >
              {caption.role === "user" ? "You" : tutor.name.split(" ")[0]}
            </p>
            <p className="text-sm text-white/95 leading-relaxed">{caption.text}</p>
          </div>
        </div>
      )}
    </div>
  );
};
