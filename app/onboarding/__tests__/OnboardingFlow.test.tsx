/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OnboardingFlow } from "../OnboardingFlow";
import { ONBOARDING_KEY } from "@/lib/onboarding-storage";

const push = jest.fn();
const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

const getUser = jest.fn();
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser: (...args: unknown[]) => getUser(...args) } }),
}));

describe("OnboardingFlow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    getUser.mockResolvedValue({ data: { user: null } });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("submits directly after the final question without showing a plan preview", async () => {
    render(<OnboardingFlow />);

    // Step 1: tutor — Luna is preselected by default, so Continue is enabled immediately.
    expect(screen.getByText("Pick your tutor")).toBeInTheDocument();
    expect(screen.getByText("You can switch anytime. All fluent in 9 languages.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Luna" }));

    // Step 2: language — Continue disabled until a language is picked.
    expect(screen.getByRole("heading", { name: "Which language do you want to speak?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Spanish" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Step 3: level
    expect(screen.getByRole("heading", { name: "Where are you starting from?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Just starting/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Step 4: motivation
    expect(screen.getByRole("heading", { name: "What's pulling you here?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Travel/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Step 5: goal
    expect(screen.getByRole("heading", { name: "How much time can you give me daily?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create my account" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /10 min per day/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Create my account" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Create my account" }));

    expect(screen.queryByText("Crafting your plan…")).not.toBeInTheDocument();
    expect(screen.queryByText("YOUR PLAN IS READY")).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/signup?next=/onboarding/complete");
  });

  it("routes a signed-in user with complete saved answers straight to completion", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    window.localStorage.setItem(
      ONBOARDING_KEY,
      JSON.stringify({ tutor: "luna", language: "spanish", level: "some", motivation: "travel", goal: 10 })
    );

    render(<OnboardingFlow />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding/complete"));
    expect(screen.queryByText("YOUR PLAN IS READY")).not.toBeInTheDocument();
  });

  it("resumes at the first incomplete step when reloaded mid-flow", async () => {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ tutor: "henry", language: "french" }));

    render(<OnboardingFlow />);

    // Resume happens in a mount-only effect (not a useState initializer, to
    // avoid a hydration mismatch), so the very first paint is the neutral
    // loading placeholder — await the resumed step's heading.
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Where are you starting from?" })).toBeInTheDocument()
    );
    expect(screen.queryByText("Pick your tutor")).not.toBeInTheDocument();
  });

  it("shows a Go back button on every step after the first", async () => {
    render(<OnboardingFlow />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Luna" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Go back" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Luna" }));

    expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument();
  });

  it("does not show the AI provider disclosure while onboarding", async () => {
    render(<OnboardingFlow />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Luna" })).toBeInTheDocument());
    expect(screen.queryByText("Google Gemini")).not.toBeInTheDocument();
    expect(screen.queryByText("Inworld AI")).not.toBeInTheDocument();
  });

  it("moves focus to the next step's heading after Continue", async () => {
    render(<OnboardingFlow />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Luna" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Continue with Luna" }));

    const languageHeading = await screen.findByRole("heading", { name: "Which language do you want to speak?" });
    expect(document.activeElement).toBe(languageHeading);

    fireEvent.click(screen.getByRole("radio", { name: "Spanish" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const levelHeading = await screen.findByRole("heading", { name: "Where are you starting from?" });
    expect(document.activeElement).toBe(levelHeading);
  });
});
