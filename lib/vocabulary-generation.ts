/**
 * AI vocabulary generation helpers.
 *
 * Ported from fina `services/aiVocabularyService.ts` (prompt shape,
 * `validateAndTransformResponse`) and `app/generate-vocabulary.tsx` (topic
 * validation, generated-lesson shape). The web version generates a single
 * language-neutral English prompt (fina's mobile app switches the prompt
 * language per target language; the web prompt instead tells the model which
 * language to write the words in) and asks for JSON only.
 */
import { getLanguage, type LanguageId } from "@/lib/languages";
import { levelLabel, type UserLevel } from "@/lib/levels";
import type { Lesson, VocabularyWord } from "@/lib/types/vocabulary";

export type WordDifficulty = "easy" | "medium" | "hard";

const TOPIC_PATTERN = /^[\p{L}\p{N}\s&,'-]+$/u;

/** 3-50 chars; letters (incl. non-Latin), numbers, spaces, and & , ' - only. */
export function validateTopic(topic: string): boolean {
  if (topic.length < 3 || topic.length > 50) return false;
  return TOPIC_PATTERN.test(topic);
}

export function buildVocabularyPrompt(input: {
  topic: string;
  difficulty: WordDifficulty;
  count: number;
  level: UserLevel;
  language: LanguageId;
}): string {
  const languageLabel = getLanguage(input.language).promptLabel;
  const level = levelLabel(input.level).toLowerCase();

  return `Generate exactly ${input.count} ${languageLabel} vocabulary words about "${input.topic}" for a ${level} learner, difficulty ${input.difficulty}. Each word, definition and example must be written in ${languageLabel}. Return ONLY a JSON array of objects with keys: word, definition, example, pronunciation (IPA or romanization), partOfSpeech (noun|verb|adjective|adverb|preposition|conjunction|interjection), difficulty (easy|medium|hard), category.`;
}

const DIFFICULTIES: WordDifficulty[] = ["easy", "medium", "hard"];
const PARTS_OF_SPEECH: NonNullable<VocabularyWord["partOfSpeech"]>[] = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "preposition",
  "conjunction",
  "interjection",
];

function isDifficulty(v: unknown): v is WordDifficulty {
  return typeof v === "string" && DIFFICULTIES.includes(v as WordDifficulty);
}

function isPartOfSpeech(v: unknown): v is NonNullable<VocabularyWord["partOfSpeech"]> {
  return typeof v === "string" && PARTS_OF_SPEECH.includes(v as VocabularyWord["partOfSpeech"] & string);
}

/**
 * Parses the model's raw text response into vocabulary words.
 *
 * Ports `validateAndTransformResponse` from fina's aiVocabularyService: strips
 * markdown code fences, accepts either a bare JSON array or a `{ words: [...] }`
 * envelope, requires `word`/`definition`/`example` on each item (dropping the
 * rest), and defaults everything else. Throws if parsing fails or zero items
 * survive validation.
 */
export function parseGeneratedWords(raw: string, topic: string, difficulty: WordDifficulty): VocabularyWord[] {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error("Could not parse generated vocabulary");
  }

  const list: unknown[] | null = Array.isArray(parsed)
    ? parsed
    : parsed != null && typeof parsed === "object" && Array.isArray((parsed as { words?: unknown }).words)
      ? ((parsed as { words: unknown[] }).words)
      : null;

  if (!list) {
    throw new Error("Could not parse generated vocabulary");
  }

  const words: VocabularyWord[] = [];

  list.forEach((raw, i) => {
    if (raw == null || typeof raw !== "object") return;
    const item = raw as Record<string, unknown>;

    if (
      typeof item.word !== "string" ||
      typeof item.definition !== "string" ||
      typeof item.example !== "string"
    ) {
      return;
    }

    words.push({
      id: `generated_${Date.now()}_${i}`,
      title_id: 999,
      word: item.word,
      definition: item.definition,
      example: item.example,
      pronunciation: typeof item.pronunciation === "string" ? item.pronunciation : "",
      difficulty: isDifficulty(item.difficulty) ? item.difficulty : difficulty,
      category: typeof item.category === "string" && item.category.trim() ? item.category : topic,
      partOfSpeech: isPartOfSpeech(item.partOfSpeech) ? item.partOfSpeech : undefined,
      audioURL: "",
    });
  });

  if (words.length === 0) {
    throw new Error("No valid vocabulary words found in generated response");
  }

  return words;
}

const DIFFICULTY_LABEL: Record<WordDifficulty, Lesson["difficulty"]> = {
  easy: "Beginner",
  medium: "Intermediate",
  hard: "Advanced",
};

/** Mirrors the generated-lesson shape from fina's generate-vocabulary.tsx. */
export function lessonFromWords(input: {
  id: string;
  topic: string;
  difficulty: WordDifficulty;
  words: VocabularyWord[];
  language?: LanguageId;
}): Lesson {
  return {
    id: input.id,
    title: input.topic,
    description: `AI-generated vocabulary words about ${input.topic}`,
    wordsCount: input.words.length,
    duration: `${Math.ceil(input.words.length * 0.8)} min`,
    difficulty: DIFFICULTY_LABEL[input.difficulty],
    completed: false,
    emoji: "🤖",
    vocabularyWords: input.words,
    ...(input.language && { language: input.language }),
  };
}
