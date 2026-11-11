"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pronunciationVoice, speechLocale, type LanguageId } from "@/lib/languages";

export interface UsePronunciationResult {
  play: (text: string, key: string) => Promise<void>;
  loadingKey: string | null;
  playingKey: string | null;
  error: string | null;
}

/**
 * Plays a word's pronunciation via `/api/tts`, caching the resulting blob URL
 * by `${key}-${language}` for the lifetime of the hook. Falls back to the
 * browser's Web SpeechSynthesis (using the language's speech locale) when the
 * TTS endpoint is unavailable (503) or otherwise fails.
 */
export function usePronunciation(language: LanguageId): UsePronunciationResult {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cacheRef = useRef<Map<string, string>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopCurrent = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speakFallback = useCallback(
    (text: string, key: string): Promise<void> => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        setError("Could not play pronunciation.");
        return Promise.resolve();
      }

      setPlayingKey(key);
      return new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = speechLocale(language);
        const finish = () => {
          setPlayingKey(null);
          resolve();
        };
        utterance.onend = finish;
        utterance.onerror = finish;
        window.speechSynthesis.speak(utterance);
      });
    },
    [language]
  );

  const play = useCallback(
    async (text: string, key: string) => {
      stopCurrent();
      setError(null);
      setPlayingKey(null);
      setLoadingKey(key);

      const cacheKey = `${key}-${language}`;

      try {
        let url = cacheRef.current.get(cacheKey);

        if (!url) {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, voiceId: pronunciationVoice(language), language }),
          });

          if (!res.ok) {
            throw new Error("tts-unavailable");
          }

          const blob = await res.blob();
          url = URL.createObjectURL(blob);
          cacheRef.current.set(cacheKey, url);
        }

        const audio = new Audio(url);
        audioRef.current = audio;
        setLoadingKey(null);
        setPlayingKey(key);

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("playback-error"));
          audio.play().catch(reject);
        });

        setPlayingKey(null);
        audioRef.current = null;
      } catch {
        setLoadingKey(null);
        await speakFallback(text, key);
      }
    },
    [language, stopCurrent, speakFallback]
  );

  // On unmount: stop any playing audio/speech and release every cached blob
  // URL so navigating away mid-clip doesn't leak audio playback or memory.
  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      for (const url of cache.values()) {
        URL.revokeObjectURL(url);
      }
      cache.clear();
    };
  }, []);

  return { play, loadingKey, playingKey, error };
}
