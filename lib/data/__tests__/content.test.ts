import { STUDY_PLAN_30, VOCAB_TOPIC_LESSON_IDS } from "@/lib/data/studyPlan";
import { roleplays, getRoleplayById } from "@/lib/data/roleplays";
import { getLessonForPlanTopic, getPredefinedLessons } from "@/lib/data/predefinedLessons";
import { LANGUAGES } from "@/lib/languages";

describe("content integrity", () => {
  it("has 30 plan days", () => expect(STUDY_PLAN_30).toHaveLength(30));
  it("every plan day points at a real roleplay", () => {
    for (const d of STUDY_PLAN_30) expect(getRoleplayById(d.roleplayId)).toBeDefined();
  });
  it.each(LANGUAGES.map((l) => l.id))("every plan vocab topic exists in %s lessons", (lang) => {
    const titles = new Set(getPredefinedLessons(lang).map((l) => l.title));
    for (const d of STUDY_PLAN_30) expect(titles).toContain(d.vocabTopic);
  });
  it.each(LANGUAGES.map((l) => l.id))("every plan vocab topic's lesson id matches %s lessons", (lang) => {
    for (const d of STUDY_PLAN_30) {
      expect(VOCAB_TOPIC_LESSON_IDS[d.vocabTopic]).toBe(getLessonForPlanTopic(d.vocabTopic, lang)?.id);
    }
  });
  it("roleplay ids are unique", () => expect(new Set(roleplays.map((r) => r.id)).size).toBe(roleplays.length));
});
