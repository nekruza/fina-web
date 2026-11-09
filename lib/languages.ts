/**
 * Supported target languages.
 *
 * Ported from fina's `components/onboarding/OnboardingShared.tsx` constants
 * (`LANGUAGES`, `LANG_GREETING`, `LEVEL_SAMPLES`) plus the speech-locale /
 * pronunciation-voice mappings used across the web app.
 */

export type LanguageId =
  | "english"
  | "english_uk"
  | "spanish"
  | "french"
  | "german"
  | "chinese"
  | "japanese"
  | "portuguese"
  | "russian"
  | "arabic";

export interface Language {
  id: LanguageId;
  label: string;
  flag: string;
  locale: string;
  code: string;
  /**
   * Name used inside AI prompts. Dialect-specific for English so the model uses
   * the right spelling and vocabulary; the plain language name everywhere else.
   */
  promptLabel: string;
}

export const LANGUAGES: Language[] = [
  { id: "english", label: "English (US)", flag: "🇺🇸", locale: "en-US", code: "EN", promptLabel: "American English" },
  { id: "english_uk", label: "English (UK)", flag: "🇬🇧", locale: "en-GB", code: "EN", promptLabel: "British English" },
  { id: "spanish", label: "Spanish", flag: "🇪🇸", locale: "es-ES", code: "ES", promptLabel: "Spanish" },
  { id: "french", label: "French", flag: "🇫🇷", locale: "fr-FR", code: "FR", promptLabel: "French" },
  { id: "german", label: "German", flag: "🇩🇪", locale: "de-DE", code: "DE", promptLabel: "German" },
  { id: "chinese", label: "Chinese", flag: "🇨🇳", locale: "zh-CN", code: "ZH", promptLabel: "Chinese" },
  { id: "japanese", label: "Japanese", flag: "🇯🇵", locale: "ja-JP", code: "JA", promptLabel: "Japanese" },
  { id: "portuguese", label: "Portuguese", flag: "🇵🇹", locale: "pt-PT", code: "PT", promptLabel: "Portuguese" },
  { id: "russian", label: "Russian", flag: "🇷🇺", locale: "ru-RU", code: "RU", promptLabel: "Russian" },
  { id: "arabic", label: "Arabic", flag: "🇸🇦", locale: "ar-SA", code: "AR", promptLabel: "Arabic" },
];

/** Onboarding offers 8 languages in mobile order (matches fina's OnboardingShared.LANGUAGES). */
export const ONBOARDING_LANGUAGE_IDS: LanguageId[] = [
  "english",
  "english_uk",
  "spanish",
  "french",
  "japanese",
  "german",
  "portuguese",
  "chinese",
  "arabic",
];

const LANGUAGE_IDS = new Set<string>(LANGUAGES.map((l) => l.id));

export function isLanguageId(v: unknown): v is LanguageId {
  return typeof v === "string" && LANGUAGE_IDS.has(v);
}

export function getLanguage(id?: string | null): Language {
  return LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];
}

export function speechLocale(id?: string | null): string {
  return getLanguage(id).locale;
}

const PRONUNCIATION_VOICES: Record<LanguageId, string> = {
  english: "Ashley",
  english_uk: "Ashley",
  spanish: "Diego",
  french: "Alain",
  german: "Johanna",
  russian: "Elena",
  portuguese: "Heitor",
  chinese: "Xinyi",
  japanese: "Asuka",
  arabic: "Omar",
};

export function pronunciationVoice(id?: string | null): string {
  const language = getLanguage(id);
  return PRONUNCIATION_VOICES[language.id];
}

/** Ported from fina OnboardingShared.LANG_GREETING. */
export const LANGUAGE_GREETING: Record<string, string> = {
  english: "Great choice! English opens every door.",
  english_uk: "Brilliant choice! English opens every door.",
  spanish: "¡Qué bueno! Spanish is beautiful.",
  french: "Magnifique! French it is.",
  japanese: "やった! Japanese — bold choice.",
  german: "Sehr gut! German is logical and fun.",
  portuguese: "Que legal! Portuguese is warm.",
  chinese: "太好了! Chinese — huge respect.",
  arabic: "ممتاز! Arabic is gorgeous.",
};

/** Ported from fina OnboardingShared.LEVEL_SAMPLES. */
export const LEVEL_SAMPLES: Record<string, string[]> = {
  english: ["Hello!", "My name is…", "How are you?", "I want to improve"],
  english_uk: ["Hello!", "My name is…", "How are you?", "I want to improve"],
  spanish: ["¡Hola!", "Me llamo…", "¿Cómo estás?", "Quiero mejorar"],
  french: ["Bonjour!", "Je m'appelle…", "Comment ça va?", "Je veux progresser"],
  japanese: ["こんにちは!", "私は…", "元気ですか?", "上達したい"],
  german: ["Hallo!", "Ich heiße…", "Wie geht's?", "Ich will besser werden"],
  portuguese: ["Olá!", "Meu nome é…", "Tudo bem?", "Quero melhorar"],
  chinese: ["你好!", "我叫…", "你好吗?", "我想进步"],
  arabic: ["مرحباً!", "اسمي…", "كيف الحال؟", "أريد التحسن"],
};
