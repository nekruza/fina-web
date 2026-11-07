import { LANGUAGES, getLanguage, speechLocale, pronunciationVoice, isLanguageId, ONBOARDING_LANGUAGE_IDS } from "@/lib/languages";
import { tutorVoice, TUTORS } from "@/lib/tutors";

describe("languages", () => {
  it("lists the supported languages with US and UK English", () => {
    expect(LANGUAGES.map((l) => l.id)).toEqual(["english","english_uk","spanish","french","german","chinese","japanese","portuguese","russian","arabic"]);
  });
  it("labels US English with the US flag and UK English with the GB flag", () => {
    expect(getLanguage("english")).toMatchObject({ label: "English (US)", flag: "🇺🇸", locale: "en-US", code: "EN", promptLabel: "American English" });
    expect(getLanguage("english_uk")).toMatchObject({ label: "English (UK)", flag: "🇬🇧", locale: "en-GB", code: "EN", promptLabel: "British English" });
  });
  it("uses the plain language name as the prompt label for every other language", () => {
    expect(getLanguage("spanish").promptLabel).toBe("Spanish");
  });
  it("gives UK English a speech locale, pronunciation voice and tutor voices", () => {
    expect(speechLocale("english_uk")).toBe("en-GB");
    expect(pronunciationVoice("english_uk")).toBe("Ashley");
    for (const tutor of TUTORS) expect(tutorVoice(tutor, "english_uk")).toBe(tutor.voices.english);
  });
  it("falls back to English for unknown ids", () => {
    expect(getLanguage("klingon").id).toBe("english");
    expect(getLanguage(null).id).toBe("english");
  });
  it("maps speech locales", () => {
    expect(speechLocale("spanish")).toBe("es-ES");
    expect(speechLocale("chinese")).toBe("zh-CN");
    expect(speechLocale(undefined)).toBe("en-US");
  });
  it("maps pronunciation voices", () => {
    expect(pronunciationVoice("german")).toBe("Johanna");
    expect(pronunciationVoice("nope")).toBe("Ashley");
  });
  it("guards ids", () => {
    expect(isLanguageId("french")).toBe(true);
    expect(isLanguageId("FRENCH")).toBe(false);
  });
  it("offers nine onboarding languages, mobile order with UK English after US", () => {
    expect(ONBOARDING_LANGUAGE_IDS).toEqual(["english","english_uk","spanish","french","japanese","german","portuguese","chinese","arabic"]);
  });
});
