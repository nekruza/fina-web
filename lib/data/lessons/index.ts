import { Lesson } from '@/lib/types/vocabulary';
import type { LanguageId } from '@/lib/languages';
import { englishLessons } from './english';
import { spanishLessons } from './spanish';
import { frenchLessons } from './french';
import { germanLessons } from './german';
import { chineseLessons } from './chinese';
import { japaneseLessons } from './japanese';
import { portugueseLessons } from './portuguese';
import { russianLessons } from './russian';
import { arabicLessons } from './arabic';
import { czechLessons } from './czech';

export const lessonsByLanguage: Record<LanguageId, Lesson[]> = {
  english: englishLessons,
  english_uk: englishLessons,
  spanish: spanishLessons,
  french: frenchLessons,
  german: germanLessons,
  chinese: chineseLessons,
  japanese: japaneseLessons,
  portuguese: portugueseLessons,
  russian: russianLessons,
  arabic: arabicLessons,
  czech: czechLessons,
};

/**
 * Get predefined lessons for a specific language.
 * Falls back to English if language is not found.
 */
export const getLessonsForLanguage = (
  languageId: string = 'english'
): Lesson[] => {
  return lessonsByLanguage[languageId as LanguageId] || englishLessons;
};

/**
 * Search lessons for a specific language by title, description, or words.
 */
export const searchLessonsForLanguage = (
  query: string,
  languageId: string = 'english'
): Lesson[] => {
  const lessons = getLessonsForLanguage(languageId);
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return lessons;

  return lessons.filter(
    (lesson) =>
      lesson.title.toLowerCase().includes(lowerQuery) ||
      lesson.description.toLowerCase().includes(lowerQuery) ||
      lesson.vocabularyWords.some((word) =>
        word.word.toLowerCase().includes(lowerQuery)
      )
  );
};
