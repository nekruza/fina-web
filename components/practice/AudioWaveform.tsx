"use client";

import { FC, useEffect, useRef, useState } from "react";

interface AudioWaveformProps {
  analyserData?: Uint8Array;
  isActive: boolean;
  barCount?: number;
  variant: "user" | "ai";
  className?: string;
}

export const AudioWaveform: FC<AudioWaveformProps> = ({
  analyserData,
  isActive,
  barCount = 5,
  variant,
  className = "",
}) => {
  const [aiBars, setAiBars] = useState<number[]>(() =>
    Array.from({ length: barCount }, () => 4)
  );
  const rafRef = useRef<number | null>(null);
  // Per-bar independent phase offsets so they don't move in sync
  const phaseRef = useRef<number[]>(
    Array.from({ length: barCount }, (_, i) => i * 1.3)
  );

  useEffect(() => {
    if (variant !== "ai") return;

    if (!isActive) return;

    // Each bar has its own speed so they feel independent
    const speeds = Array.from(
      { length: barCount },
      (_, i) => 0.04 + (i % 3) * 0.018
    );

    const tick = () => {
      phaseRef.current = phaseRef.current.map((p, i) => p + speeds[i]);
      const next = phaseRef.current.map((phase) => {
        // Combine two sine waves at different frequencies for organic feel
        const base = Math.sin(phase) * 0.6 + Math.sin(phase * 2.3) * 0.4;
        return 3 + (base + 1) * 0.5 * 14; // range ≈ 3–17 px
      });
      setAiBars(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, variant, barCount]);

  const bars =
    variant === "user" && analyserData
      ? Array.from({ length: barCount }, (_, i) => {
          const step = Math.floor(analyserData.length / barCount);
          const val = analyserData[i * step] ?? 0;
          return isActive ? Math.max(4, (val / 255) * 32) : 4;
        })
      : isActive
        ? aiBars
        : Array.from({ length: barCount }, () => 4); // resting bars between AI turns

  return (
    <div className={`flex items-center justify-center gap-[3px] ${className}`}>
      {bars.map((height, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full"
          style={{
            height: `${height}px`,
            background: "#4ade80",
            opacity: isActive ? 0.55 + (height / 20) * 0.45 : 0.3,
            transition: variant === "user" ? "height 100ms ease-out" : undefined,
          }}
        />
      ))}
    </div>
  );
};
