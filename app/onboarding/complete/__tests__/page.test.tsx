/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OnboardingCompletePage from "../page";
import { ONBOARDING_KEY } from "@/lib/onboarding-storage";

const replace = jest.fn();
const mockRouter = { replace };
const getUser = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser: (...args: unknown[]) => getUser(...args) } }),
}));

describe("OnboardingCompletePage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    replace.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "jane@example.com" } } });
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    window.localStorage.setItem(
      ONBOARDING_KEY,
      JSON.stringify({ tutor: "henry", language: "spanish", level: "some", motivation: "travel", goal: 10 })
    );
  });

  it("moves the tutor preference into account-scoped local storage before clearing onboarding answers", async () => {
    render(<OnboardingCompletePage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app"));

    expect(JSON.parse(window.localStorage.getItem("fina_user_preferences:user-1")!)).toMatchObject({
      tutorId: "henry",
      dailyGoalMinutes: 10,
    });
    expect(window.localStorage.getItem(ONBOARDING_KEY)).toBeNull();
  });

  it("retains answers after a failed save and completes when retry succeeds", async () => {
    const answers = window.localStorage.getItem(ONBOARDING_KEY);
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true });

    render(<OnboardingCompletePage />);

    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(window.localStorage.getItem(ONBOARDING_KEY)).toBe(answers);
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(retry);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app"));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem(ONBOARDING_KEY)).toBeNull();
  });
});
