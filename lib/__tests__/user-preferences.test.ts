/**
 * @jest-environment jsdom
 */
import {
  USER_PREFERENCES_KEY,
  clearUserPreferences,
  loadUserPreferences,
  saveUserPreferences,
} from "@/lib/user-preferences";

describe("user-preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns stable defaults when an account has no saved preferences", () => {
    expect(loadUserPreferences("user-1")).toEqual({ tutorId: "luna", nativeLanguage: "english", dailyGoalMinutes: 10 });
  });

  it("scopes preferences to the account id", () => {
    saveUserPreferences("user-1", { tutorId: "henry", nativeLanguage: "spanish", dailyGoalMinutes: 30 });

    expect(loadUserPreferences("user-1")).toEqual({ tutorId: "henry", nativeLanguage: "spanish", dailyGoalMinutes: 30 });
    expect(loadUserPreferences("user-2")).toEqual({ tutorId: "luna", nativeLanguage: "english", dailyGoalMinutes: 10 });
    expect(window.localStorage.getItem(`${USER_PREFERENCES_KEY}:user-1`)).not.toBeNull();
  });

  it("removes only the selected account's preferences", () => {
    saveUserPreferences("user-1", { tutorId: "jake" });
    saveUserPreferences("user-2", { tutorId: "henry" });

    clearUserPreferences("user-1");

    expect(loadUserPreferences("user-1").tutorId).toBe("luna");
    expect(loadUserPreferences("user-2").tutorId).toBe("henry");
  });
});
