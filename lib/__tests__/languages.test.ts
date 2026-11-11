import { LANGUAGES, getLanguage, speechLocale, pronunciationVoice, isLanguageId, ONBOARDING_LANGUAGE_IDS, ttsSettings, LANGUAGE_GREETING, LEVEL_SAMPLES } from "@/lib/languages";
import { tutorVoice, TUTORS } from "@/lib/tutors";

describe("languages", () => {
  it("lists the supported languages with US and UK English", () => {
    expect(LANGUAGES.map((l) => l.id)).toEqual(["english","english_uk","spanish","french","german","chinese","japanese","portuguese","russian","arabic","czech"]);
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
  it("offers ten onboarding languages, mobile order with UK English after US and Czech last", () => {
    expect(ONBOARDING_LANGUAGE_IDS).toEqual(["english","english_uk","spanish","french","japanese","german","portuguese","chinese","arabic","czech"]);
  });
  it("defines Czech with its flag, locale, voices and onboarding copy", () => {
    expect(getLanguage("czech")).toMatchObject({ label: "Czech", flag: "🇨🇿", locale: "cs-CZ", code: "CS", promptLabel: "Czech" });
    expect(pronunciationVoice("czech")).toBe("Ashley");
    expect(LANGUAGE_GREETING.czech).toBeTruthy();
    expect(LEVEL_SAMPLES.czech).toHaveLength(4);
    expect(TUTORS.map((t) => tutorVoice(t, "czech"))).toEqual(["Ashley", "Timofey", "Szymon"]);
  });
  it("gives every onboarding language a greeting and level samples", () => {
    for (const id of ONBOARDING_LANGUAGE_IDS) {
      expect(LANGUAGE_GREETING[id]).toBeTruthy();
      expect(LEVEL_SAMPLES[id]).toHaveLength(4);
    }
  });
  describe("ttsSettings", () => {
    it("synthesises Czech with TTS-2 and an explicit locale, since TTS 1.5 has no Czech", () => {
      expect(ttsSettings("czech")).toEqual({ modelId: "inworld-tts-2", language: "cs-CZ" });
    });
    it("accepts a speech locale as well as a language id", () => {
      expect(ttsSettings("cs-CZ")).toEqual({ modelId: "inworld-tts-2", language: "cs-CZ" });
    });
    it("keeps TTS 1.5 Mini with no explicit language for the existing languages", () => {
      expect(ttsSettings("spanish")).toEqual({ modelId: "inworld-tts-1.5-mini" });
      expect(ttsSettings("es-ES")).toEqual({ modelId: "inworld-tts-1.5-mini" });
    });
    it("falls back to TTS 1.5 Mini for unknown or missing languages", () => {
      expect(ttsSettings("klingon")).toEqual({ modelId: "inworld-tts-1.5-mini" });
      expect(ttsSettings(undefined)).toEqual({ modelId: "inworld-tts-1.5-mini" });
    });
  });
});
