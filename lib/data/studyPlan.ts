/**
 * 30-day study plan.
 *
 * Each day pairs a roleplay scenario (by id from roleplays.ts) with
 * a vocabulary topic (by title from the per-language lesson files).
 * The plan cycles through all 10 vocab topics 3 times and uses
 * real roleplay IDs so the home screen can deep-link directly into
 * the voice conversation and flashcard screens.
 *
 * NOTE: fina's original data/studyPlan.ts references 6 roleplayIds that don't
 * exist in data/roleplays.ts (food-coffee-1, life-movies-1, food-recipes-1,
 * life-return-1, food-cooking-1, life-birthday-1 — near-miss ids from an
 * earlier roleplays.ts revision). Corrected here to the real ids so every
 * plan day resolves via getRoleplayById, per task-2's content-integrity test.
 */

export type StudyDay = {
  day: number;
  /** Human-readable label shown in the card header */
  speakLabel: string;
  /** Roleplay scenario id from data/roleplays.ts */
  roleplayId: string;
  /** Vocab lesson title — must match a title in data/lessons/*.ts */
  vocabTopic: string;
};

export const STUDY_PLAN_30: StudyDay[] = [
  // ── Week 1: Basics ────────────────────────────────────────────
  { day: 1,  speakLabel: 'Introductions',           roleplayId: 'life-intro-1',       vocabTopic: 'Daily Life' },
  { day: 2,  speakLabel: 'Ordering at a Restaurant', roleplayId: 'food-restaurant-1',  vocabTopic: 'Food & Cooking' },
  { day: 3,  speakLabel: 'Asking for Directions',    roleplayId: 'travel-directions-1', vocabTopic: 'Travel' },
  { day: 4,  speakLabel: "How's Your Day?",          roleplayId: 'life-day-1',          vocabTopic: 'Emotions' },
  { day: 5,  speakLabel: 'Coffee Shop Order',        roleplayId: 'food-cafe-1',         vocabTopic: 'Shopping & Money' },
  { day: 6,  speakLabel: 'Weather',                  roleplayId: 'life-weather-1',      vocabTopic: 'Weather & Nature' },
  { day: 7,  speakLabel: 'Making Friends',           roleplayId: 'life-friends-1',      vocabTopic: 'Entertainment' },

  // ── Week 2: Everyday situations ───────────────────────────────
  { day: 8,  speakLabel: 'Shopping Trip',            roleplayId: 'life-shopping-1',     vocabTopic: 'Shopping & Money' },
  { day: 9,  speakLabel: 'Grocery Shopping',         roleplayId: 'food-grocery-1',      vocabTopic: 'Food & Cooking' },
  { day: 10, speakLabel: 'Taking a Taxi',            roleplayId: 'travel-taxi-1',       vocabTopic: 'Travel' },
  { day: 11, speakLabel: 'Hobbies',                  roleplayId: 'life-hobbies-1',      vocabTopic: 'Health & Fitness' },
  { day: 12, speakLabel: 'Phone Call with Friend',   roleplayId: 'life-phone-1',        vocabTopic: 'Daily Life' },
  { day: 13, speakLabel: "Doctor's Appointment",     roleplayId: 'life-doctor-1',       vocabTopic: 'Health & Fitness' },
  { day: 14, speakLabel: 'Movies & TV Shows',        roleplayId: 'life-movie-1',        vocabTopic: 'Entertainment' },

  // ── Week 3: Going deeper ──────────────────────────────────────
  { day: 15, speakLabel: 'Hotel Check-in',           roleplayId: 'travel-hotel-1',      vocabTopic: 'Travel' },
  { day: 16, speakLabel: 'At the Bank',              roleplayId: 'life-bank-1',         vocabTopic: 'Shopping & Money' },
  { day: 17, speakLabel: 'Sharing Recipes',          roleplayId: 'food-recipe-1',       vocabTopic: 'Food & Cooking' },
  { day: 18, speakLabel: 'Basic Emotions',           roleplayId: 'life-emotions-1',     vocabTopic: 'Emotions' },
  { day: 19, speakLabel: 'At the Gym',               roleplayId: 'life-gym-1',          vocabTopic: 'Health & Fitness' },
  { day: 20, speakLabel: 'Introducing Family',       roleplayId: 'life-family-1',       vocabTopic: 'Daily Life' },
  { day: 21, speakLabel: 'Sports Discussion',        roleplayId: 'life-sports-1',       vocabTopic: 'Entertainment' },

  // ── Week 4: Real-world skills ─────────────────────────────────
  { day: 22, speakLabel: 'Job Interview',            roleplayId: 'work-interview-1',    vocabTopic: 'Work & Business' },
  { day: 23, speakLabel: 'At the Airport',           roleplayId: 'travel-airport-1',    vocabTopic: 'Travel' },
  { day: 24, speakLabel: 'Returning an Item',        roleplayId: 'life-complaint-1',    vocabTopic: 'Shopping & Money' },
  { day: 25, speakLabel: 'Cooking Class',            roleplayId: 'food-cookingclass-1', vocabTopic: 'Food & Cooking' },
  { day: 26, speakLabel: 'Team Meeting',             roleplayId: 'work-meeting-1',      vocabTopic: 'Work & Business' },
  { day: 27, speakLabel: 'Birthday Party',           roleplayId: 'life-party-1',        vocabTopic: 'Emotions' },
  { day: 28, speakLabel: 'Booking a Tour',           roleplayId: 'travel-tour-1',       vocabTopic: 'Weather & Nature' },

  // ── Week 5: Mastery ───────────────────────────────────────────
  { day: 29, speakLabel: 'Networking Event',         roleplayId: 'work-networking-1',   vocabTopic: 'Technology' },
  { day: 30, speakLabel: 'General Conversation',     roleplayId: 'general',             vocabTopic: 'Daily Life' },
];

/**
 * Lesson id for each plan vocab topic. Every language file gives a topic the
 * same id, so the home screen can deep-link to a lesson without loading the
 * per-language lesson data (~70 KB gzipped) into its bundle. Kept in sync with
 * data/lessons/*.ts by the content-integrity test.
 */
export const VOCAB_TOPIC_LESSON_IDS: Record<string, number> = {
  'Daily Life': 1,
  'Food & Cooking': 2,
  'Travel': 3,
  'Work & Business': 4,
  'Technology': 5,
  'Health & Fitness': 6,
  'Shopping & Money': 7,
  'Weather & Nature': 8,
  'Entertainment': 9,
  'Emotions': 10,
};
