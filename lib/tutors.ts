import type { LanguageId } from "./languages";

/**
 * AI tutor personas.
 *
 * Ported from fina's onboarding tutor system (`components/onboarding/OnboardingShared.tsx`
 * TUTOR_NAMES/TUTOR_AVATARS) and the per-language voice map from
 * `hooks/useRealtimeVoice.ts` (AVATAR_VOICES).
 *
 * Inworld has no Czech-native voices, so the Czech entries are the voices that
 * sounded most native speaking Czech on TTS-2 (see `ttsSettings` in languages).
 */

export type TutorId = "luna" | "henry" | "jake";

export interface Tutor {
  id: TutorId;
  name: string;
  blurb: string;
  image: string;
  idleVideo: string;
  speakingVideo: string;
  accent: string;
  voices: Record<LanguageId, string>;
}

export const TUTORS: Tutor[] = [
  {
    id: "luna",
    name: "Luna",
    blurb: "Warm · patient · great for beginners",
    image: "/ai_avatars/luna.png",
    idleVideo: "/ai_avatars/luna_idle.mp4",
    speakingVideo: "/ai_avatars/luna_speaking.mp4",
    accent: "#2E5E3E",
    voices: {
      english: "Ashley",
      english_uk: "Ashley",
      spanish: "Lupita",
      french: "Hélène",
      german: "Johanna",
      russian: "Elena",
      portuguese: "Maitê",
      chinese: "Xinyi",
      japanese: "Asuka",
      arabic: "Nour",
      czech: "Ashley",
    },
  },
  {
    id: "henry",
    name: "Henry",
    blurb: "Professional · business-focused",
    image: "/ai_avatars/henry.png",
    idleVideo: "/ai_avatars/henry_idle.mp4",
    speakingVideo: "/ai_avatars/henry_speaking.mp4",
    accent: "#9A3412",
    voices: {
      english: "Clive",
      english_uk: "Clive",
      spanish: "Diego",
      french: "Alain",
      german: "Josef",
      russian: "Dmitry",
      portuguese: "Heitor",
      chinese: "Yichen",
      japanese: "Satoshi",
      arabic: "Omar",
      czech: "Timofey",
    },
  },
  {
    id: "jake",
    name: "Jake",
    blurb: "Casual · fun · loves slang",
    image: "/ai_avatars/jake.png",
    idleVideo: "/ai_avatars/jake_idle.mp4",
    speakingVideo: "/ai_avatars/jake_speaking.mp4",
    accent: "#1D4ED8",
    voices: {
      english: "Nate",
      english_uk: "Nate",
      spanish: "Miguel",
      french: "Étienne",
      german: "Josef",
      russian: "Nikolai",
      portuguese: "Heitor",
      chinese: "Yichen",
      japanese: "Satoshi",
      arabic: "Omar",
      czech: "Szymon",
    },
  },
];

export const DEFAULT_TUTOR_ID: TutorId = "luna";

const TUTOR_IDS = new Set<string>(TUTORS.map((t) => t.id));

export function isTutorId(v: unknown): v is TutorId {
  return typeof v === "string" && TUTOR_IDS.has(v);
}

export function getTutorById(id?: string | null): Tutor {
  return (
    TUTORS.find((t) => t.id === id) ??
    TUTORS.find((t) => t.id === DEFAULT_TUTOR_ID)!
  );
}

export function tutorVoice(tutor: Tutor, language: LanguageId): string {
  return tutor.voices[language] ?? tutor.voices.english;
}
