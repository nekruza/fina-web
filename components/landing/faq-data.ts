import { FREE_CONVERSATIONS, FREE_GENERATIONS } from "@/lib/billing";
import { LANGUAGES, getLanguage } from "@/lib/languages";

/**
 * Single source for the landing FAQ. The FAQ section renders these items and
 * the FAQPage JSON-LD is generated from them, so the two can never drift.
 * Answers are plain text on purpose: they go into JSON-LD verbatim.
 */
export interface FaqItem {
  question: string;
  answer: string;
}

function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Which languages can I learn?",
    answer: `English is the focus, and you can choose ${getLanguage("english").label} or ${getLanguage("english_uk").label}: Fina helps you speak it in real conversations with an AI tutor. Fina also teaches ${joinWithAnd(LANGUAGES.filter((l) => !l.id.startsWith("english")).map((l) => l.label))}. You choose a language when you set up, and you can switch at any time in Settings.`,
  },
  {
    question: "Does Fina work in my browser?",
    answer:
      "Yes. Lessons, flashcards and the study plan work in any modern browser. For voice conversations, use Chrome or Edge, which can recognize speech, and allow microphone access when your browser asks.",
  },
  {
    question: "Is my voice recorded?",
    answer:
      "Fina doesn't save recordings of your voice. Your browser's speech recognition turns what you say into text, and that text is sent to our AI services so your tutor can reply. Audio for the live conversation is processed in real time and not stored. Before your first conversation you'll see exactly what is shared, and with whom.",
  },
  {
    question: "Can I use my Fina mobile account?",
    answer:
      "Yes. It's the same Fina account, so your profile, words and progress are there when you sign in with the Google account or email you use on your phone. Sign in with Apple and Pro subscriptions bought through the app stores aren't available on the web yet.",
  },
  {
    question: "What do I get for free?",
    answer: `${FREE_CONVERSATIONS} AI conversations and ${FREE_GENERATIONS} AI word generations, plus every lesson, every flashcard and the 30-day study plan. You don't need a card to start.`,
  },
  {
    question: "Can I cancel Pro anytime?",
    answer:
      "Yes. Open Settings, choose Manage subscription and cancel in the Stripe billing portal. You keep Pro until the end of the period you've already paid for.",
  },
];
