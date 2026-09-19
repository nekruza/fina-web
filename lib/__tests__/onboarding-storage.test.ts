/**
 * @jest-environment jsdom
 */
import {
  ONBOARDING_KEY,
  loadOnboarding,
  saveOnboarding,
  clearOnboarding,
  isCompleteOnboarding,
  needsOnboarding,
  type OnboardingData,
} from "@/lib/onboarding-storage";

const COMPLETE: OnboardingData = {
  tutor: "luna",
  language: "spanish",
  level: "some",
  motivation: "travel",
  goal: 10,
};

describe("onboarding-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("loadOnboarding / saveOnboarding", () => {
    it("returns an empty object when nothing has been stored", () => {
      expect(loadOnboarding()).toEqual({});
    });

    it("persists a patch and returns the merged result", () => {
      const result = saveOnboarding({ tutor: "henry" });
      expect(result).toEqual({ tutor: "henry" });
      expect(loadOnboarding()).toEqual({ tutor: "henry" });
    });

    it("merges successive patches instead of overwriting", () => {
      saveOnboarding({ tutor: "luna" });
      saveOnboarding({ language: "french" });
      const result = saveOnboarding({ level: "convo" });

      expect(result).toEqual({ tutor: "luna", language: "french", level: "convo" });
      expect(loadOnboarding()).toEqual({ tutor: "luna", language: "french", level: "convo" });
    });

    it("overwrites a field when patched again", () => {
      saveOnboarding({ goal: 5 });
      saveOnboarding({ goal: 20 });
      expect(loadOnboarding()).toEqual({ goal: 20 });
    });

    it("stores under the documented ONBOARDING_KEY", () => {
      saveOnboarding({ tutor: "jake" });
      expect(JSON.parse(window.localStorage.getItem(ONBOARDING_KEY)!)).toEqual({ tutor: "jake" });
    });

    it("falls back to an empty object on corrupted JSON", () => {
      window.localStorage.setItem(ONBOARDING_KEY, "{not json");
      expect(loadOnboarding()).toEqual({});
    });

    it("falls back to an empty object when the stored value is an array", () => {
      window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(["a", "b"]));
      expect(loadOnboarding()).toEqual({});
    });
  });

  describe("clearOnboarding", () => {
    it("removes any saved answers", () => {
      saveOnboarding(COMPLETE);
      clearOnboarding();
      expect(loadOnboarding()).toEqual({});
      expect(window.localStorage.getItem(ONBOARDING_KEY)).toBeNull();
    });
  });

  describe("isCompleteOnboarding", () => {
    it("is false for an empty object", () => {
      expect(isCompleteOnboarding({})).toBe(false);
    });

    it("is true once every questionnaire answer is present and valid", () => {
      expect(isCompleteOnboarding(COMPLETE)).toBe(true);
    });

    it("does not require the removed AI consent field", () => {
      expect(isCompleteOnboarding(COMPLETE)).toBe(true);
    });

    it("is false for an unknown tutor id", () => {
      expect(isCompleteOnboarding({ ...COMPLETE, tutor: "bogus" as never })).toBe(false);
    });

    it("is false for an unknown language id", () => {
      expect(isCompleteOnboarding({ ...COMPLETE, language: "klingon" as never })).toBe(false);
    });

    it("is false for an empty level or motivation", () => {
      expect(isCompleteOnboarding({ ...COMPLETE, level: "" })).toBe(false);
      expect(isCompleteOnboarding({ ...COMPLETE, motivation: "" })).toBe(false);
    });

    it("is false when goal is missing", () => {
      const { goal, ...rest } = COMPLETE;
      void goal;
      expect(isCompleteOnboarding(rest)).toBe(false);
    });
  });

  describe("needsOnboarding", () => {
    it("is true when the row is null", () => {
      expect(needsOnboarding(null)).toBe(true);
    });

    it("is true when target_language is null", () => {
      expect(needsOnboarding({ target_language: null })).toBe(true);
    });

    it("is false once target_language is set", () => {
      expect(needsOnboarding({ target_language: "spanish" })).toBe(false);
    });
  });
});
