/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SettingsPage from "../page";
import type { ProfileSummary } from "@/lib/types/profile";

const push = jest.fn();
const replace = jest.fn();
const refresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

jest.mock("@/lib/queries/profile", () => ({
  useProfile: jest.fn(),
  useUpdateProfile: jest.fn(),
}));

const signOut = jest.fn().mockResolvedValue({ error: null });
jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => ({ auth: { signOut } })),
}));

// The upgrade dialog and tutor picker have their own concerns (checkout,
// keyboard nav) covered elsewhere — stub them so this suite stays focused on
// the settings page's own rendering, form state, and save/account actions.
jest.mock("@/components/ProUpgradeDialog", () => ({
  ProUpgradeDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="upgrade-dialog" /> : null),
}));

jest.mock("@/components/roleplay/TutorPicker", () => ({
  TutorPicker: () => <div data-testid="tutor-picker" />,
}));

const { useRouter, useSearchParams } = jest.requireMock("next/navigation");
const { toast } = jest.requireMock("sonner");
const { useProfile, useUpdateProfile } = jest.requireMock("@/lib/queries/profile");

function profile(overrides: Partial<ProfileSummary> = {}): ProfileSummary {
  return {
    id: "user-1",
    email: "jane@example.com",
    displayName: "Jane",
    level: "beginner",
    targetLanguage: "spanish",
    nativeLanguage: "english",
    tutorId: "luna",
    dailyGoalMinutes: 10,
    learningMotivation: null,
    onboarded: true,
    streak: { current: 0, lastConversationDate: null, weeklyActivity: [] },
    studyPlan: { startDate: null, completedDays: [] },
    stats: { conversationsCompleted: 0, avgOverallScore: null, lessonsCompleted: 0, favoriteWords: 0, generatedLessons: 0 },
    pro: { isPro: false, status: null, currentPeriodEnd: null, hasCustomer: false },
    usage: { freeConversationsRemaining: 2, freeGenerationsRemaining: 1 },
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

let mutateAsync: jest.Mock;

function setup(overrides: Partial<ProfileSummary> = {}, searchParams = "") {
  useRouter.mockReturnValue({ push, replace, refresh });
  useSearchParams.mockReturnValue(new URLSearchParams(searchParams));
  useProfile.mockReturnValue({ data: profile(overrides), isLoading: false, refetch: jest.fn() });
  mutateAsync = jest.fn().mockResolvedValue(undefined);
  useUpdateProfile.mockReturnValue({ mutateAsync });
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  window.localStorage.clear();
});

describe("rendering", () => {
  it("renders every section with its anchor id", () => {
    setup();
    render(<SettingsPage />);

    expect(document.getElementById("profile")).toBeInTheDocument();
    expect(document.getElementById("learning")).toBeInTheDocument();
    expect(document.getElementById("ai-privacy")).toBeInTheDocument();
    expect(document.getElementById("subscription")).toBeInTheDocument();
    expect(document.getElementById("account")).toBeInTheDocument();
  });

  it("shows the complete AI provider disclosure in Settings", () => {
    setup();
    render(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "AI & privacy" })).toBeInTheDocument();
    expect(screen.getByText("Google Gemini")).toBeInTheDocument();
    expect(screen.getByText("Inworld AI")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Privacy Policy" })).toHaveAttribute("href", "/privacy");
  });

  it("shows a loading state while the profile is loading", () => {
    useRouter.mockReturnValue({ push, replace, refresh });
    useSearchParams.mockReturnValue(new URLSearchParams(""));
    useProfile.mockReturnValue({ data: undefined, isLoading: true, refetch: jest.fn() });
    useUpdateProfile.mockReturnValue({ mutateAsync: jest.fn() });

    render(<SettingsPage />);

    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("pre-fills the display name and read-only email from the profile", () => {
    setup({ displayName: "Jane Doe", email: "jane.doe@example.com" });
    render(<SettingsPage />);

    expect(screen.getByLabelText("Display name")).toHaveValue("Jane Doe");
    const emailField = screen.getByLabelText("Email") as HTMLInputElement;
    expect(emailField).toHaveValue("jane.doe@example.com");
    expect(emailField).toHaveAttribute("readonly");
  });

  it("shows the free plan usage line for a free account", () => {
    setup({ usage: { freeConversationsRemaining: 2, freeGenerationsRemaining: 1 } });
    render(<SettingsPage />);

    expect(
      screen.getByText("Free plan — 2 free conversations and 1 free word generations left")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upgrade to Pro" })).toBeInTheDocument();
  });

  it("shows the renewal date and manage-subscription action for a Pro account", () => {
    setup({ pro: { isPro: true, status: "active", currentPeriodEnd: "2027-03-15T00:00:00.000Z", hasCustomer: true } });
    render(<SettingsPage />);

    expect(screen.getByText(/renews Mar 15, 2027/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage subscription" })).toBeInTheDocument();
  });

  it("shows 'active' when a Pro account has no known period end", () => {
    setup({ pro: { isPro: true, status: "active", currentPeriodEnd: null, hasCustomer: true } });
    render(<SettingsPage />);

    expect(screen.getByText(/active/)).toBeInTheDocument();
  });
});

describe("saving profile and learning fields", () => {
  it("PATCHes table-backed fields and stores local preferences separately", async () => {
    setup({ displayName: "Jane" });
    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Jane Austen" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        displayName: "Jane Austen",
        level: "beginner",
        targetLanguage: "spanish",
      })
    );
    expect(JSON.parse(window.localStorage.getItem("fina_user_preferences:user-1")!)).toMatchObject({
      nativeLanguage: "english",
      tutorId: "luna",
      dailyGoalMinutes: 10,
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Settings saved"));
  });

  it("disables saving and shows an error when the display name is cleared", () => {
    setup();
    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "   " } });

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByText("Display name is required.")).toBeInTheDocument();
  });

  it("shows the PATCH's own error message when the save fails with a specific error", async () => {
    setup();
    mutateAsync.mockRejectedValueOnce(new Error("Invalid displayName"));
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Invalid displayName"));
  });

  it("falls back to a generic error toast when the failure has no message", async () => {
    setup();
    mutateAsync.mockRejectedValueOnce("network down");
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to save settings"));
  });
});

describe("upgrade dialog preselection", () => {
  it("opens the upgrade dialog when ?plan= is present for a free user", () => {
    setup({ pro: { isPro: false, status: null, currentPeriodEnd: null, hasCustomer: false } }, "plan=monthly");
    render(<SettingsPage />);

    expect(screen.getByTestId("upgrade-dialog")).toBeInTheDocument();
  });

  it("does not open the upgrade dialog for a Pro user even with ?plan=", () => {
    setup({ pro: { isPro: true, status: "active", currentPeriodEnd: null, hasCustomer: true } }, "plan=monthly");
    render(<SettingsPage />);

    expect(screen.queryByTestId("upgrade-dialog")).not.toBeInTheDocument();
  });
});

describe("?upgraded=1 handling", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function setupUpgraded(refetch: jest.Mock) {
    useRouter.mockReturnValue({ push, replace, refresh });
    useSearchParams.mockReturnValue(new URLSearchParams("upgraded=1"));
    useProfile.mockReturnValue({
      data: profile({ pro: { isPro: false, status: null, currentPeriodEnd: null, hasCustomer: false } }),
      isLoading: false,
      refetch,
    });
    useUpdateProfile.mockReturnValue({ mutateAsync: jest.fn() });
  }

  it("shows the welcome toast immediately, then removes the param once pro.isPro comes back true", async () => {
    const refetch = jest
      .fn()
      .mockResolvedValueOnce({
        data: profile({ pro: { isPro: false, status: null, currentPeriodEnd: null, hasCustomer: false } }),
      })
      .mockResolvedValueOnce({
        data: profile({ pro: { isPro: true, status: "active", currentPeriodEnd: null, hasCustomer: true } }),
      });
    setupUpgraded(refetch);

    render(<SettingsPage />);
    expect(toast.success).toHaveBeenCalledWith("Welcome to Fina Pro!");

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });
    expect(refetch).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledWith("/app/settings", { scroll: false });
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("shows a processing toast and removes the param after 5 polls with no Pro yet", async () => {
    const refetch = jest.fn().mockResolvedValue({
      data: profile({ pro: { isPro: false, status: null, currentPeriodEnd: null, hasCustomer: false } }),
    });
    setupUpgraded(refetch);

    render(<SettingsPage />);

    for (let i = 0; i < 5; i += 1) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(2000);
      });
    }

    expect(refetch).toHaveBeenCalledTimes(5);
    expect(toast.info).toHaveBeenCalledWith("Your upgrade is processing — it can take a minute to appear.");
    expect(replace).toHaveBeenCalledWith("/app/settings", { scroll: false });
  });

  it("does not show the welcome toast or poll when ?upgraded= is absent", () => {
    const refetch = jest.fn();
    useRouter.mockReturnValue({ push, replace, refresh });
    useSearchParams.mockReturnValue(new URLSearchParams(""));
    useProfile.mockReturnValue({ data: profile(), isLoading: false, refetch });
    useUpdateProfile.mockReturnValue({ mutateAsync: jest.fn() });

    render(<SettingsPage />);
    jest.advanceTimersByTime(10000);

    expect(toast.success).not.toHaveBeenCalledWith("Welcome to Fina Pro!");
    expect(refetch).not.toHaveBeenCalled();
  });
});

describe("account actions", () => {
  it("signs out and redirects home", async () => {
    setup();
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/");
  });

  it("requires typing DELETE before the delete-account button is enabled", () => {
    setup();
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    // The account section's own trigger becomes aria-hidden behind the open
    // dialog, so this now resolves to the dialog's confirm button.
    const confirmButton = screen.getByRole("button", { name: "Delete account" });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("DELETE"), { target: { value: "DELETE" } });
    expect(confirmButton).toBeEnabled();
  });

  it("deletes the account, signs out, and replaces to home on confirm", async () => {
    setup();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    fireEvent.change(screen.getByPlaceholderText("DELETE"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/account", { method: "DELETE" }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("shows an error toast and does not sign out when account deletion fails", async () => {
    setup();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    fireEvent.change(screen.getByPlaceholderText("DELETE"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to delete account. Please try again."));
    expect(signOut).not.toHaveBeenCalled();
  });
});
